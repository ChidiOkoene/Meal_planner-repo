import { ServiceUnavailableException } from '@nestjs/common';
import { type AuthProviderGateway } from './clerk.gateway.js';

const notConfigured = () =>
  Promise.reject(new ServiceUnavailableException('Sign-in is not configured'));

/** Used when no auth provider is configured (local development without Clerk keys). */
export class UnconfiguredGateway implements AuthProviderGateway {
  getIdentity = notConfigured;
  clearInvitedStaffRole = notConfigured;
  inviteStaff = notConfigured;
  revokeAllSessions = notConfigured;
}
