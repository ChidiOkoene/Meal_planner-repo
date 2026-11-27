import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { generateKeyEntry } from '@dyjext/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type FakeAuthProvider, signIn } from '../testing/auth.js';
import { nextWeek, type PlannerPreviewResponse } from './planning.service.js';

describe('nextWeek', () => {
  it('returns next Monday to Sunday', () => {
    expect(nextWeek(new Date('2026-11-26T10:00:00Z'))).toEqual([
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
      '2026-12-05',
      '2026-12-06',
    ]);
    // On a Monday, plan the following week rather than today.
    expect(nextWeek(new Date('2026-11-30T08:00:00Z'))[0]).toBe('2026-12-07');
  });
});

// Needs a migrated and seeded database.
const hasServices = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

describe.skipIf(!hasServices)('planner preview', () => {
  let app: NestFastifyApplication;
  let staff: Record<string, string>;

  beforeAll(async () => {
    let auth: FakeAuthProvider;
    ({ app, auth } = await createTestApp());
    staff = signIn(auth, { staffRole: 'dietitian' }).headers;
  });
  afterAll(() => app.close());

  const preview = (body: object) =>
    app.inject({ method: 'POST', url: '/v1/ops/planner/preview', payload: body, headers: staff });

  it('lists the example profiles', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/ops/planner/presets', headers: staff });
    expect(res.json<{ id: string }[]>().map((p) => p.id)).toEqual([
      'diabetes_hypertension',
      'diabetes',
      'hypertension',
      'chewing_difficulty',
    ]);
  });

  it('plans a valid week from the seeded catalogue, flagging draft dishes', async () => {
    const res = await preview({ presetId: 'diabetes_hypertension', seed: 'test' });
    expect(res.statusCode).toBe(200);
    const body = res.json<PlannerPreviewResponse>();
    expect(body.plan.status).toBe('ok');
    expect(body.plan.days).toHaveLength(7);
    expect(body.plan.days[0]!.meals.map((m) => m.mealType)).toEqual([
      'breakfast',
      'lunch',
      'snack',
      'dinner',
    ]);
    // Sample dishes are drafts: allowed in a preview, but never silently.
    expect(body.validation.status).toBe('warnings');
    expect(new Set(body.validation.problems.map((p) => p.rule))).toEqual(new Set(['draft_dish']));
    expect(body.explanation.days[0]!.checks.length).toBeGreaterThan(0);
  });

  it('respects excluded ingredients', async () => {
    const ingredients = (
      await app.inject({ method: 'GET', url: '/v1/ops/ingredients', headers: staff })
    ).json<{ id: string; name: string }[]>();
    const eggs = ingredients.find((i) => i.name === 'Eggs')!;
    const res = await preview({
      presetId: 'diabetes',
      excludedIngredientIds: [eggs.id],
      seed: 'no-eggs',
    });
    const body = res.json<PlannerPreviewResponse>();
    const names = body.plan.days.flatMap((d) => d.meals.flatMap((m) => m.items.map((i) => i.name)));
    expect(names.some((n) => /egg sauce|egg and tomato|Moi moi/.test(n))).toBe(false);
  });

  it('explains why a request cannot be met instead of breaking a rule', async () => {
    const res = await preview({ presetId: 'chewing_difficulty', seed: 'test' });
    const body = res.json<PlannerPreviewResponse>();
    expect(body.plan.status).toBe('infeasible');
    expect(body.plan.unmet.length).toBeGreaterThan(0);
    expect(body.validation.status).toBe('failed');
  });

  it('rejects an unknown profile', async () => {
    expect((await preview({ presetId: 'keto' })).statusCode).toBe(400);
  });

  it('does not exist in production, even for staff', async () => {
    const { app: prod, auth } = await createTestApp({
      env: { NODE_ENV: 'production', DATA_ENCRYPTION_KEYS: generateKeyEntry('test') },
    });
    try {
      const anonymous = await prod.inject({
        method: 'POST',
        url: '/v1/ops/planner/preview',
        payload: { presetId: 'diabetes' },
      });
      expect(anonymous.statusCode).toBe(404);
      const staffMember = signIn(auth, { staffRole: 'admin' });
      const signedIn = await prod.inject({
        method: 'POST',
        url: '/v1/ops/planner/preview',
        payload: { presetId: 'diabetes' },
        headers: staffMember.headers,
      });
      expect(signedIn.statusCode).toBe(404);
    } finally {
      await prod.close();
    }
  });
});
