import { randomInt } from 'node:crypto';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { normaliseMobileNumber } from '@dyjext/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { createTestApp, type FakeAuthProvider, signIn } from '../testing/auth.js';

const hasServices = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

/**
 * A fresh, valid Nigerian or UK mobile number, so tests never collide. Not every number in a
 * range is allocated, so draw until the phone library accepts one.
 */
function mobile(prefix: string, length: number, country: 'NG' | 'GB'): string {
  for (;;) {
    const candidate = `${prefix}${String(randomInt(0, 10 ** length)).padStart(length, '0')}`;
    if (normaliseMobileNumber(candidate, country)) return candidate;
  }
}
const ngMobile = () => mobile('0803', 7, 'NG');
const ukMobile = () => mobile('07911', 6, 'GB');

const lagos = { line1: '12 Example Street', area: 'Surulere', city: 'Lagos' };

interface RecipientView {
  id: string;
  phoneE164: string;
  serviceTier: string;
  status: string;
  isYou: boolean;
  relationship: string;
}

describe.skipIf(!hasServices)('households and recipients', () => {
  let app: NestFastifyApplication;
  let auth: FakeAuthProvider;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, auth } = await createTestApp());
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  type Headers = Record<string, string>;
  const call = (method: 'GET' | 'POST', url: string, headers: Headers, payload?: object) =>
    app.inject({ method, url: `/v1${url}`, headers, payload });

  async function newHousehold(headers: Headers, billingCurrency = 'GBP') {
    const res = await call('POST', '/households', headers, { name: 'Our family', billingCurrency });
    expect(res.statusCode).toBe(201);
    return res.json<{ id: string; role: string }>();
  }

  const addRecipient = (headers: Headers, householdId: string, body: object) =>
    call('POST', `/households/${householdId}/recipients`, headers, body);

  it('creates a household with the caller as owner, and lists it', async () => {
    const payer = signIn(auth);
    const household = await newHousehold(payer.headers, 'NGN');
    expect(household.role).toBe('owner');
    const mine = await call('GET', '/households', payer.headers);
    expect(mine.json<{ id: string; billingCurrency: string }[]>()).toEqual([
      expect.objectContaining({ id: household.id, billingCurrency: 'NGN' }),
    ]);
    const bad = await call('POST', '/households', payer.headers, {
      name: 'X',
      billingCurrency: 'JPY',
    });
    expect(bad.statusCode).toBe(400);
  });

  it('adds a parent in Lagos with full care, and asks for their consent', async () => {
    const payer = signIn(auth);
    const { id } = await newHousehold(payer.headers);
    const local = ngMobile();
    const res = await addRecipient(payer.headers, id, {
      relationship: 'parent',
      displayName: 'Mama',
      phone: local,
      language: 'yo',
      countryCode: 'NG',
      address: lagos,
    });
    expect(res.statusCode).toBe(201);
    const recipient = res.json<RecipientView>();
    expect(recipient).toMatchObject({
      phoneE164: `+234${local.slice(1)}`,
      serviceTier: 'full_care',
      status: 'invited',
      isYou: false,
    });

    const events = await prisma.outboxEvent.findMany({ where: { aggregateId: recipient.id } });
    expect(events.map((e) => e.eventType)).toEqual(['recipient.invited']);
    const address = await prisma.recipient.findUniqueOrThrow({
      where: { id: recipient.id },
      include: { address: true },
    });
    expect(address.address).toMatchObject({ city: 'Lagos', countryCode: 'NG' });
  });

  it('lets a payer subscribe for themself, once', async () => {
    const payer = signIn(auth);
    const { id } = await newHousehold(payer.headers);
    const res = await addRecipient(payer.headers, id, {
      relationship: 'self',
      displayName: 'Tunde',
      phone: ukMobile(),
      countryCode: 'GB',
    });
    expect(res.statusCode).toBe(201);
    const self = res.json<RecipientView>();
    expect(self).toMatchObject({ isYou: true, serviceTier: 'plan_only' });

    const me = await call('GET', '/me', payer.headers);
    expect(me.json()).toMatchObject({
      selfRecipient: { id: self.id, householdId: id, serviceTier: 'plan_only' },
    });

    const other = await newHousehold(payer.headers);
    const again = await addRecipient(payer.headers, other.id, {
      relationship: 'self',
      displayName: 'Tunde',
      phone: ukMobile(),
      countryCode: 'GB',
    });
    expect(again.statusCode).toBe(409);
    expect(again.json<{ error: { message: string } }>().error.message).toMatch(
      /already added yourself/,
    );
  });

  it('refuses a number that is already registered, or not a mobile', async () => {
    const payer = signIn(auth);
    const { id } = await newHousehold(payer.headers);
    const phone = ngMobile();
    const body = { relationship: 'parent', displayName: 'Papa', phone, countryCode: 'NG' };
    expect((await addRecipient(payer.headers, id, body)).statusCode).toBe(201);

    const someoneElse = signIn(auth);
    const theirs = await newHousehold(someoneElse.headers);
    const duplicate = await addRecipient(someoneElse.headers, theirs.id, {
      ...body,
      phone: `+234${phone.slice(1)}`,
    });
    expect(duplicate.statusCode).toBe(409);

    const invalid = await addRecipient(payer.headers, id, { ...body, phone: '12345' });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json<{ error: { details: { path: string }[] } }>().error.details).toEqual([
      expect.objectContaining({ path: 'phone' }),
    ]);
  });

  it('offers full care only where vendors deliver', async () => {
    const payer = signIn(auth);
    const { id } = await newHousehold(payer.headers);
    const res = await addRecipient(payer.headers, id, {
      relationship: 'parent',
      displayName: 'Papa',
      phone: ngMobile(),
      countryCode: 'NG',
      serviceTier: 'full_care',
      address: { line1: '1 Road', city: 'Abuja' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatch(/only available in Lagos/);
  });

  it('lets members and support staff read, but only the owner change things', async () => {
    const owner = signIn(auth);
    const { id } = await newHousehold(owner.headers);
    const sibling = signIn(auth);
    await call('GET', '/me', sibling.headers);
    const siblingUser = await prisma.user.findUniqueOrThrow({
      where: { authProviderId: sibling.providerUserId },
    });
    await prisma.householdMember.create({
      data: { householdId: id, userId: siblingUser.id, role: 'member' },
    });
    const ops = signIn(auth, { staffRole: 'ops' });
    const stranger = signIn(auth);
    const body = {
      relationship: 'parent',
      displayName: 'Mama',
      phone: ngMobile(),
      countryCode: 'NG',
    };

    expect((await call('GET', `/households/${id}/recipients`, sibling.headers)).statusCode).toBe(
      200,
    );
    expect((await call('GET', `/households/${id}/recipients`, ops.headers)).statusCode).toBe(200);
    expect((await call('GET', `/households/${id}`, stranger.headers)).statusCode).toBe(404);
    expect((await addRecipient(sibling.headers, id, body)).statusCode).toBe(403);
    expect((await addRecipient(ops.headers, id, body)).statusCode).toBe(403);
    expect((await addRecipient(stranger.headers, id, body)).statusCode).toBe(404);
  });

  it('lets the owner pause, resume and close, but not consent for the recipient', async () => {
    const payer = signIn(auth);
    const { id } = await newHousehold(payer.headers);
    const recipient = (
      await addRecipient(payer.headers, id, {
        relationship: 'parent',
        displayName: 'Mama',
        phone: ngMobile(),
        countryCode: 'NG',
      })
    ).json<RecipientView>();
    const setStatus = (status: string) =>
      call('POST', `/households/${id}/recipients/${recipient.id}/status`, payer.headers, {
        status,
      });

    expect((await setStatus('active')).statusCode).toBe(400);
    expect((await setStatus('paused')).statusCode).toBe(400);

    // Consent and the dietitian's intake make a recipient active (later issues).
    await prisma.recipient.update({ where: { id: recipient.id }, data: { status: 'active' } });
    expect((await setStatus('paused')).json<RecipientView>().status).toBe('paused');
    expect((await setStatus('active')).json<RecipientView>().status).toBe('active');
    expect((await setStatus('closed')).json<RecipientView>().status).toBe('closed');
    expect((await setStatus('active')).statusCode).toBe(400);

    const timeline = await call('GET', `/households/${id}/timeline`, payer.headers);
    expect(timeline.json<{ items: { kind: string }[] }>().items.map((e) => e.kind)).toEqual([
      'recipient.closed',
      'recipient.resumed',
      'recipient.paused',
      'recipient.invited',
      'household.created',
    ]);
  });

  it('pages through the timeline', async () => {
    const payer = signIn(auth);
    const { id } = await newHousehold(payer.headers);
    for (let i = 0; i < 2; i++) {
      await addRecipient(payer.headers, id, {
        relationship: 'relative',
        displayName: `Aunty ${i}`,
        phone: ngMobile(),
        countryCode: 'NG',
      });
    }
    const first = (await call('GET', `/households/${id}/timeline?limit=2`, payer.headers)).json<{
      items: { kind: string }[];
      nextCursor: string | null;
    }>();
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = (
      await call(
        'GET',
        `/households/${id}/timeline?limit=2&cursor=${first.nextCursor}`,
        payer.headers,
      )
    ).json<{ items: { kind: string }[]; nextCursor: string | null }>();
    expect(second.items.map((e) => e.kind)).toEqual(['household.created']);
    expect(second.nextCursor).toBeNull();
  });
});
