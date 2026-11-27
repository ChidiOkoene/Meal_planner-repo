import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type AuthUser } from './auth-user.js';
import { CurrentUser } from './decorators.js';

@ApiTags('me')
@ApiBearerAuth()
@Controller()
export class MeController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** The signed-in user: roles, households, and whether staff tools are unlocked. */
  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const memberships = await this.prisma.householdMember.findMany({
      where: { userId: user.id },
      include: { household: { select: { id: true, name: true, status: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const isStaff = user.staffRoles.length > 0;
    const authenticator = isStaff
      ? await this.prisma.staffTwoFactor.findUnique({
          where: { userId: user.id },
          select: { confirmedAt: true },
        })
      : null;
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      staffRoles: user.staffRoles,
      staff: isStaff
        ? {
            twoFactorEnabled: user.twoFactorEnabled,
            // Whether the built-in authenticator app is set up (the alternative to the provider's).
            authenticatorApp: Boolean(authenticator?.confirmedAt),
            // False when 2-step is off, or this session didn't use it: staff routes refuse access.
            unlocked: user.staffSignInOk,
            // False only outside production when STAFF_REQUIRE_TWO_FACTOR=false; the web app warns.
            twoFactorRequired: this.config.STAFF_REQUIRE_TWO_FACTOR,
          }
        : null,
      households: memberships.map((m) => ({ ...m.household, role: m.role })),
      // Set when this user subscribes for themself (ADR 010).
      selfRecipient: await this.prisma.recipient.findUnique({
        where: { userId: user.id },
        select: { id: true, householdId: true, status: true, serviceTier: true },
      }),
    };
  }
}
