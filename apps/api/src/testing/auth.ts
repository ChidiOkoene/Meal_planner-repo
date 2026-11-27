// Test helpers: real RS256 session tokens signed with a local key, and a fake auth provider.
// Tokens are verified by Clerk's own verifyToken with the matching public key, so the tests
// exercise the real verification path without a Clerk account.
import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import { type DynamicModule } from '@nestjs/common';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { generateKeyEntry } from '@dyjext/db';
import { createApp } from '../app.factory.js';
import { type AuthProviderGateway, type IdentityInfo } from '../auth/clerk.gateway.js';
import { loadConfig } from '../config/config.js';

export const WEB_ORIGIN = 'http://localhost:3000';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const TEST_JWT_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const b64url = (value: object | Buffer) =>
  (Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))).toString('base64url');

/** A session token as Clerk would issue it. Override claims to test failures. */
export function signToken(claims: Record<string, unknown>, key = privateKey): string {
  const now = Math.floor(Date.now() / 1000);
  // `cat` marks a Clerk session token; the SDK rejects other token categories as sessions.
  const header = b64url({ alg: 'RS256', typ: 'JWT', kid: 'test', cat: 'cl_B7d4PD111AAA' });
  const payload = b64url({
    iat: now,
    nbf: now - 5,
    exp: now + 300,
    azp: WEB_ORIGIN,
    iss: 'https://test.clerk',
    ...claims,
  });
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(key);
  return `${header}.${payload}.${b64url(signature)}`;
}

/** In-memory stand-in for Clerk. Records what the API asked it to do. */
export class FakeAuthProvider implements AuthProviderGateway {
  readonly identities = new Map<string, IdentityInfo>();
  readonly invitations: { email: string; role: string; redirectUrl: string }[] = [];
  readonly revokedSessionsFor: string[] = [];
  readonly clearedRolesFor: string[] = [];

  add(identity: Partial<IdentityInfo> & { providerUserId: string }): IdentityInfo {
    const full: IdentityInfo = {
      email: `${identity.providerUserId}@example.test`,
      emailVerified: true,
      displayName: 'Test User',
      twoFactorEnabled: false,
      blocked: false,
      invitedStaffRole: null,
      ...identity,
    };
    this.identities.set(full.providerUserId, full);
    return full;
  }

  getIdentity(id: string): Promise<IdentityInfo> {
    const identity = this.identities.get(id);
    return identity
      ? Promise.resolve({ ...identity })
      : Promise.reject(new Error(`No such user ${id}`));
  }

  clearInvitedStaffRole(id: string): Promise<void> {
    this.clearedRolesFor.push(id);
    const identity = this.identities.get(id);
    if (identity) identity.invitedStaffRole = null;
    return Promise.resolve();
  }

  inviteStaff(params: { email: string; role: string; redirectUrl: string }) {
    this.invitations.push(params);
    return Promise.resolve({ invitationId: `inv_${randomUUID()}` });
  }

  revokeAllSessions(id: string): Promise<number> {
    this.revokedSessionsFor.push(id);
    return Promise.resolve(1);
  }
}

/** The API wired to the fake provider and the test signing key. */
export async function createTestApp(
  options: { extraModules?: DynamicModule['imports']; env?: Record<string, string> } = {},
): Promise<{ app: NestFastifyApplication; auth: FakeAuthProvider }> {
  const auth = new FakeAuthProvider();
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    // Set TEST_LOG_LEVEL=error to see server errors behind a failing test.
    LOG_LEVEL: process.env.TEST_LOG_LEVEL ?? 'silent',
    RATE_LIMIT_PER_MINUTE: '10000',
    CLERK_SECRET_KEY: 'sk_test_fake',
    CLERK_JWT_KEY: TEST_JWT_PUBLIC_KEY,
    AUTH_AUTHORIZED_PARTIES: WEB_ORIGIN,
    DATA_ENCRYPTION_KEYS: generateKeyEntry('test'),
    // Tests choose this explicitly, whatever the developer's .env says.
    STAFF_REQUIRE_TWO_FACTOR: 'true',
    ...options.env,
  });
  const app = await createApp(config, {
    extraModules: options.extraModules,
    auth: { provider: auth },
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return { app, auth };
}

/**
 * A signed-in person with a unique identity. `staffRole` arrives the way it does in real life:
 * through an invitation, applied on first sign-in. Staff get 2-step verification by default.
 */
export function signIn(
  auth: FakeAuthProvider,
  options: {
    staffRole?: 'dietitian' | 'ops' | 'admin';
    twoFactor?: boolean;
    secondFactorAge?: number;
  } = {},
) {
  const providerUserId = `user_test_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
  const twoFactor = options.twoFactor ?? Boolean(options.staffRole);
  const identity = auth.add({
    providerUserId,
    invitedStaffRole: options.staffRole ?? null,
    twoFactorEnabled: twoFactor,
  });
  const tokenFor = (sessionId: string) =>
    signToken({
      sub: providerUserId,
      sid: sessionId,
      fva: [0, options.secondFactorAge ?? (twoFactor ? 0 : -1)],
    });
  const token = tokenFor(`sess_${providerUserId}`);
  return {
    providerUserId,
    email: identity.email,
    token,
    headers: { authorization: `Bearer ${token}` },
    /** Headers for a separate sign-in of the same person (a new session id). */
    newSession: () => ({ authorization: `Bearer ${tokenFor(`sess_${randomUUID()}`)}` }),
  };
}
