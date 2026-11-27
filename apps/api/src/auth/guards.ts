import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type StaffRoleType } from '@dyjext/db';
import { type FastifyRequest } from 'fastify';
import { PrismaService } from '../prisma/prisma.service.js';
import { HOUSEHOLD_PARAM, IS_PUBLIC, STAFF_ROLES } from './metadata.js';
import { IdentityService } from './identity.service.js';
import { TOKEN_VERIFIER, type TokenVerifier } from './token-verifier.js';

/** Global guard: every route requires a valid session unless marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    @Inject(IdentityService) private readonly identity: IdentityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    if (!this.verifier.configured)
      throw new ServiceUnavailableException('Sign-in is not configured');
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    // Bearer tokens only (no cookies), so cross-site requests can't act as the user.
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Sign in required');

    const result = await this.verifier.verify(token);
    if (!result.ok) throw new UnauthorizedException('Sign in required');
    request.user = await this.identity.resolve(result.claims);
    return true;
  }
}

/** Staff roles, plus 2-step verification: staff can see health data. */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndMerge<StaffRoleType[]>(STAFF_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    const user = context.switchToHttp().getRequest<FastifyRequest>().user;
    if (!user) throw new UnauthorizedException('Sign in required');

    const allowed =
      user.staffRoles.includes('admin') ||
      (required.length === 0
        ? user.staffRoles.length > 0
        : required.some((r) => user.staffRoles.includes(r)));
    if (!allowed) throw new ForbiddenException('You do not have access to this');

    // 2-step verification set up and used this session (see AuthUser.staffSignInOk).
    if (!user.staffSignInOk) {
      throw new ForbiddenException({
        code: 'two_factor_required',
        message: 'Staff must turn on 2-step verification and use it to sign in',
      });
    }
    return true;
  }
}

/** Household members, or ops staff and admins for support. Others get 404, not 403. */
@Injectable()
export class HouseholdAccessGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const param = this.reflector.get<string>(HOUSEHOLD_PARAM, context.getHandler()) ?? 'id';
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = request.user;
    if (!user) throw new UnauthorizedException('Sign in required');
    const householdId = (request.params as Record<string, string | undefined>)[param];
    if (!householdId) throw new NotFoundException();

    const isSupportStaff =
      (user.staffRoles.includes('ops') || user.staffRoles.includes('admin')) && user.staffSignInOk;
    if (isSupportStaff) return true;

    const member = await this.prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId: user.id } },
    });
    // Not found rather than forbidden, so ids of other households can't be probed.
    if (!member) throw new NotFoundException('Household not found');
    return true;
  }
}
