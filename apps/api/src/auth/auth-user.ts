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
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}
