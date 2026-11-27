import { type StaffRoleType } from '@dyjext/db';

/** The signed-in user, attached to each authenticated request. */
export interface AuthUser {
  id: string;
  providerUserId: string;
  email: string;
  displayName: string;
  staffRoles: StaffRoleType[];
  twoFactorEnabled: boolean;
  sessionId: string | null;
  /** Whether this session passed a second factor (from the token), if the token says. */
  secondFactorVerified: boolean | null;
  /**
   * Whether this staff member's sign-in is strong enough for the staff console: the auth
   * provider's 2-step used this session, or this session unlocked with the built-in
   * authenticator app; unless STAFF_REQUIRE_TWO_FACTOR is false (never in production).
   * Every staff check reads this one value.
   */
  staffSignInOk: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}
