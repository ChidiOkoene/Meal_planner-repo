import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type StaffInvitation, staffInvitationSchema, staffRoleParamsSchema } from '@dyjext/shared';
import { type z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { ApiZodBody } from '../common/openapi.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type AuthUser } from './auth-user.js';
import { AUTH_PROVIDER, type AuthProviderGateway } from './clerk.gateway.js';
import { CurrentUser, StaffOnly } from './decorators.js';

/** Staff access management. Admins only. Every change is audited. */
@ApiTags('staff')
@ApiBearerAuth()
@StaffOnly('admin')
@Controller('ops/staff')
export class StaffController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AUTH_PROVIDER) private readonly provider: AuthProviderGateway,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Everyone with a current staff role. */
  @Get()
  async list() {
    const users = await this.prisma.user.findMany({
      where: { staffRoles: { some: { revokedAt: null } } },
      include: { staffRoles: { where: { revokedAt: null }, orderBy: { grantedAt: 'asc' } } },
      orderBy: { displayName: 'asc' },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      twoFactorEnabled: u.twoFactorEnabled,
      lastSignInAt: u.lastSignInAt,
      roles: u.staffRoles.map((r) => ({ role: r.role, grantedAt: r.grantedAt })),
    }));
  }

  /** Email an invitation. The role is applied when the person signs up through it. */
  @Post('invitations')
  @ApiZodBody(staffInvitationSchema)
  async invite(
    @CurrentUser() admin: AuthUser,
    @Body(new ZodValidationPipe(staffInvitationSchema)) body: StaffInvitation,
  ) {
    const { invitationId } = await this.provider.inviteStaff({
      email: body.email,
      role: body.role,
      redirectUrl: new URL('/sign-up', this.config.WEB_URL).toString(),
    });
    await this.audit.record({
      actorType: 'user',
      actorUserId: admin.id,
      action: 'staff.invited',
      entityType: 'user',
      entityId: admin.id,
      metadata: { role: body.role, invitationId },
    });
    return { invitationId, email: body.email, role: body.role };
  }

  /**
   * Remove a staff role and end all of that person's sessions immediately. Their personal
   * email keeps working elsewhere, but not here.
   */
  @Delete(':userId/roles/:role')
  @HttpCode(200)
  async removeRole(
    @CurrentUser() admin: AuthUser,
    @Param(new ZodValidationPipe(staffRoleParamsSchema))
    params: z.infer<typeof staffRoleParamsSchema>,
  ) {
    if (params.userId === admin.id && params.role === 'admin') {
      const otherAdmins = await this.prisma.staffRole.count({
        where: { role: 'admin', revokedAt: null, userId: { not: admin.id } },
      });
      if (otherAdmins === 0)
        throw new BadRequestException('You are the last admin; add another admin first');
    }
    const role = await this.prisma.staffRole.findUnique({
      where: { userId_role: { userId: params.userId, role: params.role } },
      include: { user: true },
    });
    if (!role || role.revokedAt)
      throw new BadRequestException('This person does not have that role');

    await this.prisma.staffRole.update({ where: { id: role.id }, data: { revokedAt: new Date() } });
    const sessionsEnded = role.user.authProviderId
      ? await this.provider.revokeAllSessions(role.user.authProviderId)
      : 0;
    await this.audit.record({
      actorType: 'user',
      actorUserId: admin.id,
      action: 'staff_role.removed',
      entityType: 'user',
      entityId: params.userId,
      metadata: { role: params.role, sessionsEnded },
    });
    return { removed: params.role, sessionsEnded };
  }
}
