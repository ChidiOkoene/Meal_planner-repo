import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { StaffRoleType } from '@dyjext/db';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AUTH_PROVIDER, type AuthProviderGateway } from './clerk.gateway.js';
import { type AuthUser } from './auth-user.js';
import { type SessionClaims } from './token-verifier.js';

/** Re-read identity details from the auth provider at most this often. */
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const STAFF_ROLES = new Set<string>(Object.values(StaffRoleType));

/**
 * Turns a verified session into our own user record. Roles always come from our database;
 * the auth provider only proves who someone is.
 */
@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AUTH_PROVIDER) private readonly provider: AuthProviderGateway,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async resolve(claims: SessionClaims): Promise<AuthUser> {
    let user = await this.prisma.user.findUnique({ where: { authProviderId: claims.sub } });
    const stale =
      !user?.identitySyncedAt || Date.now() - user.identitySyncedAt.getTime() > SYNC_INTERVAL_MS;
    if (!user || stale) user = await this.sync(claims.sub);

    const roles = await this.prisma.staffRole.findMany({
      where: { userId: user.id, revokedAt: null },
    });
    const secondFactorAge = claims.fva?.[1];
    return {
      id: user.id,
      providerUserId: claims.sub,
      email: user.email,
      displayName: user.displayName,
      staffRoles: roles.map((r) => r.role),
      twoFactorEnabled: user.twoFactorEnabled,
      sessionId: claims.sid ?? null,
      secondFactorVerified: secondFactorAge === undefined ? null : secondFactorAge >= 0,
    };
  }

  /** Create or refresh our user from the auth provider, and apply an invited staff role once. */
  private async sync(providerUserId: string) {
    const identity = await this.provider.getIdentity(providerUserId);
    if (identity.blocked) throw new ForbiddenException('This account is blocked');
    if (!identity.email) throw new ForbiddenException('An email address is required');

    const now = new Date();
    const fields = {
      displayName: identity.displayName,
      twoFactorEnabled: identity.twoFactorEnabled,
      identitySyncedAt: now,
      lastSignInAt: now,
    };

    const existing = await this.prisma.user.findUnique({
      where: { authProviderId: providerUserId },
    });
    let user;
    if (existing) {
      user = await this.prisma.user.update({ where: { id: existing.id }, data: fields });
    } else {
      // Link to a record created before sign-in existed (e.g. seeded staff) only by a
      // verified email; otherwise someone could claim another person's record.
      const byEmail = await this.prisma.user.findUnique({ where: { email: identity.email } });
      if (byEmail && (byEmail.authProviderId || !identity.emailVerified)) {
        throw new ForbiddenException('This email address belongs to another account');
      }
      user = byEmail
        ? await this.prisma.user.update({
            where: { id: byEmail.id },
            data: { ...fields, authProviderId: providerUserId },
          })
        : await this.prisma.user.create({
            data: { ...fields, authProviderId: providerUserId, email: identity.email },
          });
    }

    if (identity.invitedStaffRole)
      await this.applyInvitedRole(user.id, providerUserId, identity.invitedStaffRole);
    return user;
  }

  private async applyInvitedRole(
    userId: string,
    providerUserId: string,
    role: string,
  ): Promise<void> {
    if (!STAFF_ROLES.has(role)) {
      this.logger.warn(`Ignoring unknown invited staff role "${role}"`);
    } else {
      const previous = await this.prisma.staffRole.findUnique({
        where: { userId_role: { userId, role: role as StaffRoleType } },
      });
      // A role that was removed is never brought back by an old invitation.
      if (!previous) {
        await this.prisma.staffRole.create({ data: { userId, role: role as StaffRoleType } });
        await this.audit.record({
          actorType: 'system',
          action: 'staff_role.granted_by_invitation',
          entityType: 'user',
          entityId: userId,
          metadata: { role },
        });
      }
    }
    await this.provider.clearInvitedStaffRole(providerUserId);
  }
}
