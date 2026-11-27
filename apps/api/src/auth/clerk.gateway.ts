import { createClerkClient } from '@clerk/backend';

/** What the API needs to know about an identity from the auth provider. */
export interface IdentityInfo {
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string;
  twoFactorEnabled: boolean;
  /** Banned or locked by an admin or by brute-force protection. */
  blocked: boolean;
  /** Staff role granted by an invitation, waiting to be applied. */
  invitedStaffRole: string | null;
}

/**
 * The few auth-provider operations the API uses. Everything else in the API depends on this
 * interface, not on Clerk, so tests can substitute a fake and the provider could be swapped.
 */
export interface AuthProviderGateway {
  getIdentity(providerUserId: string): Promise<IdentityInfo>;
  /** Remove the invitation's staff role from the provider once it has been applied. */
  clearInvitedStaffRole(providerUserId: string): Promise<void>;
  /** Email an invitation; signing up through it carries the role. */
  inviteStaff(params: {
    email: string;
    role: string;
    redirectUrl: string;
  }): Promise<{ invitationId: string }>;
  /** End every active session, e.g. when staff access is removed. Returns how many. */
  revokeAllSessions(providerUserId: string): Promise<number>;
}

/** Injection token. */
export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');

export class ClerkGateway implements AuthProviderGateway {
  private readonly clerk;

  constructor(secretKey: string) {
    this.clerk = createClerkClient({ secretKey });
  }

  async getIdentity(providerUserId: string): Promise<IdentityInfo> {
    const user = await this.clerk.users.getUser(providerUserId);
    const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ?? null;
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    const staffRole = (user.publicMetadata as { staffRole?: unknown }).staffRole;
    return {
      providerUserId: user.id,
      email: primary?.emailAddress ?? null,
      emailVerified: primary?.verification?.status === 'verified',
      displayName: name || primary?.emailAddress.split('@')[0] || 'User',
      twoFactorEnabled: user.twoFactorEnabled,
      blocked: user.banned || user.locked,
      invitedStaffRole: typeof staffRole === 'string' ? staffRole : null,
    };
  }

  async clearInvitedStaffRole(providerUserId: string): Promise<void> {
    await this.clerk.users.updateUserMetadata(providerUserId, {
      publicMetadata: { staffRole: null },
    });
  }

  async inviteStaff(params: { email: string; role: string; redirectUrl: string }) {
    const invitation = await this.clerk.invitations.createInvitation({
      emailAddress: params.email,
      publicMetadata: { staffRole: params.role },
      redirectUrl: params.redirectUrl,
      notify: true,
      expiresInDays: 7,
    });
    return { invitationId: invitation.id };
  }

  async revokeAllSessions(providerUserId: string): Promise<number> {
    const { data } = await this.clerk.sessions.getSessionList({
      userId: providerUserId,
      status: 'active',
    });
    await Promise.all(data.map((session) => this.clerk.sessions.revokeSession(session.id)));
    return data.length;
  }
}
