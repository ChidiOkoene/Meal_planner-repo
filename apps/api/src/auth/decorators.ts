import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { type StaffRoleType } from '@dyjext/db';
import { type FastifyRequest } from 'fastify';
import { type AuthUser } from './auth-user.js';
import { HouseholdAccessGuard, StaffGuard } from './guards.js';
import { HOUSEHOLD_PARAM, IS_PUBLIC, STAFF_ROLES } from './metadata.js';

/** Open to everyone, signed in or not. Every other route requires sign-in. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Staff only: requires one of `roles` (any staff role if none given) and 2-step verification.
 * Admins pass every staff check.
 */
export const StaffOnly = (...roles: StaffRoleType[]) =>
  applyDecorators(SetMetadata(STAFF_ROLES, roles), UseGuards(StaffGuard));

/**
 * The signed-in user must belong to the household in route parameter `param`
 * (default "id"). Ops staff and admins may also access it, for support.
 */
export const HouseholdAccess = (param = 'id') =>
  applyDecorators(SetMetadata(HOUSEHOLD_PARAM, param), UseGuards(HouseholdAccessGuard));

/** The signed-in user. Only on routes that require sign-in. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const user = context.switchToHttp().getRequest<FastifyRequest>().user;
    if (!user) throw new Error('CurrentUser used on a public route');
    return user;
  },
);
