import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Recipient } from '@dyjext/db';
import { recordEvent } from '@dyjext/jobs';
import {
  canPayerChangeStatus,
  type CreateHousehold,
  type CreateRecipient,
  type PaginationQuery,
  type RecipientStatus,
} from '@dyjext/shared';
import { type AuthUser } from '../auth/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

/** What a payer sees of a recipient. Health details live elsewhere and are never included. */
function recipientView(r: Recipient & { address?: { city: string; area: string | null } | null }) {
  return {
    id: r.id,
    displayName: r.displayName,
    relationship: r.relationship,
    isYou: r.userId !== null,
    phoneE164: r.phoneE164,
    language: r.language,
    countryCode: r.countryCode,
    timezone: r.timezone,
    serviceTier: r.serviceTier,
    status: r.status,
    deliveryArea: r.address ? { city: r.address.city, area: r.address.area } : null,
    createdAt: r.createdAt,
  };
}

/** Weekly food budget in whole naira (stored in kobo), or null when not set. */
const budgetNaira = (h: { weeklyFoodBudgetMinor: bigint | null }) =>
  h.weeklyFoodBudgetMinor === null ? null : Number(h.weeklyFoodBudgetMinor / 100n);

/** Households and the people they pay for (ADR 010). */
@Injectable()
export class HouseholdsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Create a household with the caller as its owner. */
  async create(user: AuthUser, input: CreateHousehold) {
    return this.prisma.$transaction(async (tx) => {
      const household = await tx.household.create({
        data: {
          name: input.name,
          billingCurrency: input.billingCurrency,
          ...(input.weeklyFoodBudgetNaira
            ? {
                weeklyFoodBudgetMinor: BigInt(input.weeklyFoodBudgetNaira) * 100n, // kobo
                weeklyFoodBudgetCurrency: 'NGN',
              }
            : {}),
          members: { create: { userId: user.id, role: 'owner' } },
        },
      });
      await this.record(tx, household.id, user.id, 'household.created', null, {
        name: household.name,
      });
      return {
        id: household.id,
        name: household.name,
        status: household.status,
        billingCurrency: household.billingCurrency,
        weeklyFoodBudgetNaira: budgetNaira(household),
        role: 'owner' as const,
        createdAt: household.createdAt,
      };
    });
  }

  /** The caller's households, each with its recipients. */
  async listMine(user: AuthUser) {
    const memberships = await this.prisma.householdMember.findMany({
      where: { userId: user.id },
      include: { household: { include: { recipients: { include: { address: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map(({ household: h, role }) => ({
      id: h.id,
      name: h.name,
      status: h.status,
      billingCurrency: h.billingCurrency,
      weeklyFoodBudgetNaira: budgetNaira(h),
      role,
      recipients: h.recipients.map(recipientView),
    }));
  }

  async get(householdId: string) {
    const h = await this.prisma.household.findUniqueOrThrow({
      where: { id: householdId },
      include: { recipients: { include: { address: true }, orderBy: { createdAt: 'asc' } } },
    });
    return {
      id: h.id,
      name: h.name,
      status: h.status,
      billingCurrency: h.billingCurrency,
      weeklyFoodBudgetNaira: budgetNaira(h),
      createdAt: h.createdAt,
      recipients: h.recipients.map(recipientView),
    };
  }

  /**
   * Add the person this household pays for, or the payer themself. They are sent a consent
   * request on WhatsApp (via the outbox); nothing else happens until they agree.
   */
  async addRecipient(user: AuthUser, householdId: string, input: CreateRecipient) {
    await this.requireOwner(user, householdId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const address = input.address
          ? await tx.address.create({ data: { ...input.address, countryCode: input.countryCode } })
          : null;
        // Plain ids (not relation `connect`): connecting a one-to-one relation would quietly
        // move a user's existing "self" link instead of failing on the unique constraint.
        const recipient = await tx.recipient.create({
          data: {
            householdId,
            displayName: input.displayName,
            relationship: input.relationship,
            userId: input.relationship === 'self' ? user.id : null,
            phoneE164: input.phoneE164,
            language: input.language,
            countryCode: input.countryCode,
            timezone: input.timezone,
            serviceTier: input.serviceTier,
            addressId: address?.id ?? null,
          },
          include: { address: true },
        });
        await recordEvent(tx, {
          aggregateType: 'recipient',
          aggregateId: recipient.id,
          eventType: 'recipient.invited',
          payload: { householdId, recipientId: recipient.id, language: recipient.language },
        });
        await this.record(tx, householdId, user.id, 'recipient.invited', recipient.id, {
          displayName: recipient.displayName,
          relationship: recipient.relationship,
          serviceTier: recipient.serviceTier,
        });
        return recipientView(recipient);
      });
    } catch (error) {
      throw this.duplicateError(error) ?? error;
    }
  }

  async listRecipients(householdId: string) {
    const recipients = await this.prisma.recipient.findMany({
      where: { householdId },
      include: { address: true },
      orderBy: { createdAt: 'asc' },
    });
    return recipients.map(recipientView);
  }

  /** Pause, resume or close a recipient's service. */
  async changeStatus(
    user: AuthUser,
    householdId: string,
    recipientId: string,
    to: RecipientStatus,
  ) {
    await this.requireOwner(user, householdId);
    const recipient = await this.prisma.recipient.findFirst({
      where: { id: recipientId, householdId },
    });
    if (!recipient) throw new NotFoundException('Recipient not found');
    if (recipient.status === to) return recipientView(recipient);
    if (!canPayerChangeStatus(recipient.status, to)) {
      throw new BadRequestException(`A ${recipient.status} recipient can't be set to ${to}`);
    }
    return this.prisma.$transaction(async (tx) => {
      // Conditional on the status read above, so two racing changes can't both apply.
      const { count } = await tx.recipient.updateMany({
        where: { id: recipientId, status: recipient.status },
        data: { status: to },
      });
      if (count === 0) throw new ConflictException('The status changed meanwhile; try again');
      const kind = `recipient.${to === 'active' ? 'resumed' : to}`;
      await recordEvent(tx, {
        aggregateType: 'recipient',
        aggregateId: recipientId,
        eventType: kind,
        payload: { householdId, recipientId, from: recipient.status },
      });
      await this.record(tx, householdId, user.id, kind, recipientId, {
        displayName: recipient.displayName,
      });
      return recipientView({ ...recipient, status: to });
    });
  }

  /** Newest first, `limit` at a time; pass the last id as `cursor` for the next page. */
  async timeline(householdId: string, page: PaginationQuery) {
    const entries = await this.prisma.householdTimelineEntry.findMany({
      where: { householdId, ...(page.cursor ? { id: { lt: page.cursor } } : {}) },
      // UUIDv7 ids are time-ordered, so id order is event order.
      orderBy: { id: 'desc' },
      take: page.limit + 1,
    });
    const items = entries.slice(0, page.limit);
    return {
      items: items.map((e) => ({
        id: e.id,
        kind: e.kind,
        recipientId: e.recipientId,
        data: e.data,
        occurredAt: e.occurredAt,
      })),
      nextCursor: entries.length > page.limit ? items[items.length - 1]!.id : null,
    };
  }

  private async requireOwner(user: AuthUser, householdId: string) {
    const member = await this.prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId: user.id } },
    });
    if (member?.role !== 'owner') {
      throw new ForbiddenException('Only the household owner can do this');
    }
  }

  private record(
    tx: Tx,
    householdId: string,
    actorUserId: string,
    kind: string,
    recipientId: string | null,
    data: Prisma.InputJsonObject,
  ) {
    return tx.householdTimelineEntry.create({
      data: { householdId, actorUserId, kind, recipientId, data },
    });
  }

  private duplicateError(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return null;
    }
    const target = JSON.stringify(error.meta ?? {});
    if (target.includes('user_id') || target.includes('userId')) {
      return new ConflictException('You have already added yourself to a household');
    }
    return new ConflictException('This WhatsApp number is already registered');
  }
}
