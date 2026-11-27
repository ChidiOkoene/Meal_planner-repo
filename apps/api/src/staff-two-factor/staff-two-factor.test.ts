import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { createTestApp, type FakeAuthProvider, signIn } from '../testing/auth.js';
import { base32Decode, codeForStep, stepAt } from './totp.js';

const hasServices = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

/** The code an authenticator app would show, `offset` steps from now. */
const appCode = (secret: string, offset = 0) =>
  codeForStep(base32Decode(secret), stepAt(Date.now()) + offset);

describe.skipIf(!hasServices)('staff authenticator app', () => {
  let app: NestFastifyApplication;
  let auth: FakeAuthProvider;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, auth } = await createTestApp());
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  const call = (
    method: 'GET' | 'POST' | 'DELETE',
    url: string,
    headers: Record<string, string>,
    payload?: object,
  ) => app.inject({ method, url: `/v1${url}`, headers, payload });

  /** A staff member on a plan without the provider's 2-step: locked out until they use the app. */
  const newStaff = (role: 'dietitian' | 'ops' | 'admin' = 'dietitian') =>
    signIn(auth, { staffRole: role, twoFactor: false });

  async function enrol(person: ReturnType<typeof newStaff>) {
    const setup = await call('POST', '/me/staff-two-factor/setup', person.headers);
    expect(setup.statusCode).toBe(200);
    const { secret } = setup.json<{ secret: string }>();
    const confirm = await call('POST', '/me/staff-two-factor/confirm', person.headers, {
      code: appCode(secret),
    });
    expect(confirm.statusCode).toBe(200);
    return { secret, backupCodes: confirm.json<{ backupCodes: string[] }>().backupCodes };
  }

  /** Pretend the last code was used a while ago, so the current one isn't a replay. */
  const forgetLastCode = (person: { providerUserId: string }) =>
    prisma.staffTwoFactor.updateMany({
      where: { user: { authProviderId: person.providerUserId } },
      data: { lastUsedStep: stepAt(Date.now()) - 5 },
    });

  const consoleStatus = async (headers: Record<string, string>) =>
    (await call('GET', '/ops/dishes', headers)).statusCode;

  it('is for staff only', async () => {
    const family = signIn(auth);
    expect((await call('GET', '/me/staff-two-factor', family.headers)).statusCode).toBe(403);
    expect((await call('POST', '/me/staff-two-factor/setup', family.headers)).statusCode).toBe(403);
  });

  it('sets up with a QR link, stores the secret encrypted, and unlocks the console', async () => {
    const person = newStaff();
    expect(await consoleStatus(person.headers)).toBe(403);

    const setup = await call('POST', '/me/staff-two-factor/setup', person.headers);
    const { secret, otpauthUri } = setup.json<{ secret: string; otpauthUri: string }>();
    expect(otpauthUri).toContain(`secret=${secret}`);
    expect(otpauthUri).toContain('issuer=Dyjext+Care');
    const stored = await prisma.staffTwoFactor.findFirstOrThrow({
      where: { user: { authProviderId: person.providerUserId } },
    });
    expect(stored.secretEncrypted).toMatch(/^enc:v1:/);
    expect(stored.secretEncrypted).not.toContain(secret);

    const wrong = await call('POST', '/me/staff-two-factor/confirm', person.headers, {
      code: appCode(secret, 5),
    });
    expect(wrong.statusCode).toBe(400);
    expect(await consoleStatus(person.headers)).toBe(403);

    const confirm = await call('POST', '/me/staff-two-factor/confirm', person.headers, {
      code: appCode(secret),
    });
    expect(confirm.statusCode).toBe(200);
    const { backupCodes } = confirm.json<{ backupCodes: string[] }>();
    expect(backupCodes).toHaveLength(10);
    const hashes = await prisma.staffBackupCode.findMany({ where: { userId: stored.userId } });
    expect(hashes.map((h) => h.codeHash).join()).not.toContain(backupCodes[0]!.slice(0, 5));

    expect(await consoleStatus(person.headers)).toBe(200);
    const me = await call('GET', '/me', person.headers);
    expect(me.json()).toMatchObject({ staff: { unlocked: true, authenticatorApp: true } });
    const audit = await prisma.auditLog.count({
      where: { entityId: stored.userId, action: 'staff_two_factor.enrolled' },
    });
    expect(audit).toBe(1);
  });

  it('refuses a second setup once an app is set up', async () => {
    const person = newStaff();
    await enrol(person);
    expect((await call('POST', '/me/staff-two-factor/setup', person.headers)).statusCode).toBe(409);
  });

  it('needs a code again for each new sign-in, and never accepts a code twice', async () => {
    const person = newStaff();
    const { secret } = await enrol(person);
    const second = person.newSession();
    expect(await consoleStatus(second)).toBe(403);

    // The code used for setup can't be replayed to unlock another session.
    const replay = await call('POST', '/me/staff-two-factor/verify', second, {
      code: appCode(secret),
    });
    expect(replay.statusCode).toBe(400);

    await forgetLastCode(person);
    const ok = await call('POST', '/me/staff-two-factor/verify', second, {
      code: appCode(secret),
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ method: 'authenticator_app' });
    expect(await consoleStatus(second)).toBe(200);

    const third = person.newSession();
    const again = await call('POST', '/me/staff-two-factor/verify', third, {
      code: appCode(secret),
    });
    expect(again.statusCode).toBe(400);
  });

  it('unlocks for twelve hours only', async () => {
    const person = newStaff();
    await enrol(person);
    expect(await consoleStatus(person.headers)).toBe(200);
    await prisma.staffTwoFactorSession.updateMany({
      where: { user: { authProviderId: person.providerUserId } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await consoleStatus(person.headers)).toBe(403);
  });

  it('accepts each backup code once', async () => {
    const person = newStaff();
    const { backupCodes } = await enrol(person);
    const session = person.newSession();
    const typedLoosely = backupCodes[0]!.toLowerCase().replace('-', ' ');
    const ok = await call('POST', '/me/staff-two-factor/verify', session, { code: typedLoosely });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ method: 'backup_code' });
    expect(await consoleStatus(session)).toBe(200);

    const reused = await call('POST', '/me/staff-two-factor/verify', person.newSession(), {
      code: backupCodes[0],
    });
    expect(reused.statusCode).toBe(400);
    const status = await call('GET', '/me/staff-two-factor', session);
    expect(status.json()).toMatchObject({ enrolled: true, backupCodesLeft: 9 });
  });

  it('locks after five wrong codes in a row', async () => {
    const person = newStaff();
    const { secret, backupCodes } = await enrol(person);
    const session = person.newSession();
    for (let i = 0; i < 4; i++) {
      const res = await call('POST', '/me/staff-two-factor/verify', session, { code: '000000' });
      expect(res.statusCode).toBe(400);
    }
    const fifth = await call('POST', '/me/staff-two-factor/verify', session, { code: '000000' });
    expect(fifth.statusCode).toBe(429);
    expect(fifth.json<{ error: { message: string } }>().error.message).toMatch(
      /Try again in 15 minutes/,
    );

    // Even a right code (or a backup code) is refused while locked.
    await forgetLastCode(person);
    for (const code of [appCode(secret), backupCodes[1]]) {
      const res = await call('POST', '/me/staff-two-factor/verify', session, { code });
      expect(res.statusCode).toBe(429);
    }
    expect(await consoleStatus(session)).toBe(403);
  });

  it('lets an admin reset a lost phone, audited; the person sets up again', async () => {
    const admin = newStaff('admin');
    await enrol(admin);
    const person = newStaff();
    await enrol(person);
    const user = await prisma.user.findUniqueOrThrow({
      where: { authProviderId: person.providerUserId },
    });

    const list = await call('GET', '/ops/staff', admin.headers);
    expect(list.json<{ id: string; authenticatorApp: boolean }[]>()).toContainEqual(
      expect.objectContaining({ id: user.id, authenticatorApp: true }),
    );

    // Not for non-admins, even unlocked ones.
    expect(
      (await call('DELETE', `/ops/staff/${user.id}/two-factor`, person.headers)).statusCode,
    ).toBe(403);

    const reset = await call('DELETE', `/ops/staff/${user.id}/two-factor`, admin.headers);
    expect(reset.statusCode).toBe(200);
    expect(await consoleStatus(person.headers)).toBe(403);
    expect(await prisma.staffBackupCode.count({ where: { userId: user.id } })).toBe(0);
    const audit = await prisma.auditLog.findMany({
      where: { entityId: user.id, action: 'staff_two_factor.reset' },
    });
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { authProviderId: admin.providerUserId },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]!.actorUserId).toBe(adminUser.id);

    // They can set up a new app straight away.
    await enrol(person);
    expect(await consoleStatus(person.headers)).toBe(200);
  });

  it('ends unlocked sessions when a staff role is removed', async () => {
    const admin = newStaff('admin');
    await enrol(admin);
    const person = newStaff('ops');
    await enrol(person);
    const user = await prisma.user.findUniqueOrThrow({
      where: { authProviderId: person.providerUserId },
    });
    const res = await call('DELETE', `/ops/staff/${user.id}/roles/ops`, admin.headers);
    expect(res.statusCode).toBe(200);
    expect(await prisma.staffTwoFactorSession.count({ where: { userId: user.id } })).toBe(0);
  });

  it("still accepts the auth provider's own 2-step", async () => {
    const person = signIn(auth, { staffRole: 'dietitian', twoFactor: true });
    expect(await consoleStatus(person.headers)).toBe(200);
  });

  it('cannot unlock a session that belongs to someone else', async () => {
    const person = newStaff();
    await enrol(person);
    const other = newStaff();
    // The other person's token carries their own session id; unlocking theirs isn't possible
    // with this person's codes, and this person's unlock doesn't carry over.
    expect(await consoleStatus(other.headers)).toBe(403);
  });
});
