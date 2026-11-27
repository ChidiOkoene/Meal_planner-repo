import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { createTestApp, type FakeAuthProvider, signIn, signToken } from '../testing/auth.js';

const hasServices = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

describe.skipIf(!hasServices)('authentication and access control', () => {
  let app: NestFastifyApplication;
  let auth: FakeAuthProvider;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, auth } = await createTestApp());
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  const get = (url: string, headers: Record<string, string> = {}) =>
    app.inject({ method: 'GET', url, headers });

  describe('sign-in', () => {
    it('requires sign-in everywhere except public routes', async () => {
      expect((await get('/v1/me')).statusCode).toBe(401);
      expect((await get('/v1/ops/dishes')).statusCode).toBe(401);
      expect((await get('/healthz')).statusCode).toBe(200);
      expect((await get('/v1/meta')).statusCode).toBe(200);
    });

    it('rejects forged, expired, foreign-site and cookie-only tokens', async () => {
      const someone = signIn(auth);
      const forgedKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
      const bad = [
        signToken({ sub: someone.providerUserId }, forgedKey),
        signToken({ sub: someone.providerUserId, exp: Math.floor(Date.now() / 1000) - 60 }),
        signToken({ sub: someone.providerUserId, azp: 'https://evil.example' }),
      ];
      for (const token of bad) {
        expect((await get('/v1/me', { authorization: `Bearer ${token}` })).statusCode).toBe(401);
      }
      expect((await get('/v1/me', { cookie: `__session=${someone.token}` })).statusCode).toBe(401);
    });

    it('creates our user on first sign-in, with no staff role', async () => {
      const person = signIn(auth);
      const res = await get('/v1/me', person.headers);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        email: person.email,
        staffRoles: [],
        staff: null,
        households: [],
      });
      expect(await prisma.user.count({ where: { authProviderId: person.providerUserId } })).toBe(1);
    });

    it('links an existing record only by a verified email', async () => {
      const email = `linked-${randomUUID()}@example.test`;
      await prisma.user.create({ data: { email, displayName: 'Pre-existing' } });

      const unverified = `user_test_unverified_${randomUUID().slice(0, 8)}`;
      auth.add({ providerUserId: unverified, email, emailVerified: false });
      expect(
        (await get('/v1/me', { authorization: `Bearer ${signToken({ sub: unverified })}` }))
          .statusCode,
      ).toBe(403);

      const verified = `user_test_verified_${randomUUID().slice(0, 8)}`;
      auth.add({ providerUserId: verified, email, emailVerified: true });
      const res = await get('/v1/me', { authorization: `Bearer ${signToken({ sub: verified })}` });
      expect(res.statusCode).toBe(200);
      expect((await prisma.user.findUniqueOrThrow({ where: { email } })).authProviderId).toBe(
        verified,
      );
    });

    it('refuses blocked accounts', async () => {
      const person = signIn(auth);
      auth.identities.get(person.providerUserId)!.blocked = true;
      expect((await get('/v1/me', person.headers)).statusCode).toBe(403);
    });
  });

  describe('households', () => {
    it('lets members see their own household and hides everyone else’s', async () => {
      const owner = signIn(auth);
      const stranger = signIn(auth);
      await get('/v1/me', owner.headers);
      const ownerUser = await prisma.user.findUniqueOrThrow({
        where: { authProviderId: owner.providerUserId },
      });
      const household = await prisma.household.create({
        data: {
          name: 'Auth test family',
          billingCurrency: 'GBP',
          members: { create: { userId: ownerUser.id, role: 'owner' } },
        },
      });

      expect((await get(`/v1/households/${household.id}`, owner.headers)).statusCode).toBe(200);
      expect(
        (await get('/v1/me', owner.headers))
          .json<{ households: { id: string }[] }>()
          .households.map((h) => h.id),
      ).toEqual([household.id]);
      // Not 403: other households' ids can't be probed.
      expect((await get(`/v1/households/${household.id}`, stranger.headers)).statusCode).toBe(404);

      const ops = signIn(auth, { staffRole: 'ops' });
      expect((await get(`/v1/households/${household.id}`, ops.headers)).statusCode).toBe(200);
      const dietitian = signIn(auth, { staffRole: 'dietitian' });
      expect((await get(`/v1/households/${household.id}`, dietitian.headers)).statusCode).toBe(404);
    });
  });

  describe('staff', () => {
    it('applies an invited role once, on first sign-in, then clears it from the provider', async () => {
      const dietitian = signIn(auth, { staffRole: 'dietitian' });
      const me = (await get('/v1/me', dietitian.headers)).json<{
        staffRoles: string[];
        staff: { unlocked: boolean };
      }>();
      expect(me.staffRoles).toEqual(['dietitian']);
      expect(me.staff.unlocked).toBe(true);
      expect(auth.clearedRolesFor).toContain(dietitian.providerUserId);
      expect((await get('/v1/ops/dishes', dietitian.headers)).statusCode).toBe(200);
    });

    it('keeps families out of the staff console', async () => {
      const family = signIn(auth);
      expect((await get('/v1/ops/dishes', family.headers)).statusCode).toBe(403);
    });

    it('requires 2-step verification to be on, and used in this session', async () => {
      const noTwoStep = signIn(auth, { staffRole: 'dietitian', twoFactor: false });
      const res = await get('/v1/ops/dishes', noTwoStep.headers);
      expect(res.statusCode).toBe(403);
      expect((await get('/v1/me', noTwoStep.headers)).json()).toMatchObject({
        staff: { unlocked: false },
      });

      const skipped = signIn(auth, {
        staffRole: 'dietitian',
        twoFactor: true,
        secondFactorAge: -1,
      });
      expect((await get('/v1/ops/dishes', skipped.headers)).statusCode).toBe(403);
    });

    it('limits staff management to admins and audits invitations', async () => {
      const dietitian = signIn(auth, { staffRole: 'dietitian' });
      const admin = signIn(auth, { staffRole: 'admin' });
      const invite = { email: `new-${randomUUID().slice(0, 8)}@example.test`, role: 'ops' };

      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/v1/ops/staff/invitations',
            headers: dietitian.headers,
            payload: invite,
          })
        ).statusCode,
      ).toBe(403);
      const res = await app.inject({
        method: 'POST',
        url: '/v1/ops/staff/invitations',
        headers: admin.headers,
        payload: invite,
      });
      expect(res.statusCode).toBe(201);
      expect(auth.invitations.at(-1)).toMatchObject({
        email: invite.email,
        role: 'ops',
        redirectUrl: 'http://localhost:3000/sign-up',
      });

      const adminUser = await prisma.user.findUniqueOrThrow({
        where: { authProviderId: admin.providerUserId },
      });
      expect(
        await prisma.auditLog.count({
          where: { actorUserId: adminUser.id, action: 'staff.invited' },
        }),
      ).toBe(1);

      const list = await get('/v1/ops/staff', admin.headers);
      expect(list.json<{ email: string }[]>().map((s) => s.email)).toContain(dietitian.email);
    });

    it('removes access at once: role revoked, sessions ended, old invitation never re-applied', async () => {
      const admin = signIn(auth, { staffRole: 'admin' });
      const leaver = signIn(auth, { staffRole: 'ops' });
      await get('/v1/me', admin.headers);
      expect((await get('/v1/ops/dishes', leaver.headers)).statusCode).toBe(200);
      const leaverUser = await prisma.user.findUniqueOrThrow({
        where: { authProviderId: leaver.providerUserId },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/ops/staff/${leaverUser.id}/roles/ops`,
        headers: admin.headers,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ removed: 'ops', sessionsEnded: 1 });
      expect(auth.revokedSessionsFor).toContain(leaver.providerUserId);
      expect((await get('/v1/ops/dishes', leaver.headers)).statusCode).toBe(403);

      // Even if the provider still carried the old invitation, the role doesn't come back.
      auth.identities.get(leaver.providerUserId)!.invitedStaffRole = 'ops';
      await prisma.user.update({ where: { id: leaverUser.id }, data: { identitySyncedAt: null } });
      expect((await get('/v1/me', leaver.headers)).json()).toMatchObject({ staffRoles: [] });
    });

    it('refuses to remove the last admin', async () => {
      const admins = await prisma.staffRole.findMany({ where: { role: 'admin', revokedAt: null } });
      // Make a fresh admin the only one, for this check.
      const solo = signIn(auth, { staffRole: 'admin' });
      await get('/v1/me', solo.headers);
      const soloUser = await prisma.user.findUniqueOrThrow({
        where: { authProviderId: solo.providerUserId },
      });
      await prisma.staffRole.updateMany({
        where: { id: { in: admins.map((a) => a.id) } },
        data: { revokedAt: new Date() },
      });
      try {
        const res = await app.inject({
          method: 'DELETE',
          url: `/v1/ops/staff/${soloUser.id}/roles/admin`,
          headers: solo.headers,
        });
        expect(res.statusCode).toBe(400);
        expect(res.json<{ error: { message: string } }>().error.message).toMatch(/last admin/);
      } finally {
        await prisma.staffRole.updateMany({
          where: { id: { in: admins.map((a) => a.id) } },
          data: { revokedAt: null },
        });
      }
    });
  });
});
