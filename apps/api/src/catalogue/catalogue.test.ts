import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  Cuisine,
  DishTexture,
  DishType,
  DishVerification,
  IngredientCategory,
  MealType,
} from '@dyjext/db';
import {
  cuisineSchema,
  dishTextureSchema,
  dishTypeSchema,
  dishVerificationSchema,
  ingredientCategorySchema,
  mealTypeSchema,
} from '@dyjext/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type FakeAuthProvider, signIn } from '../testing/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CatalogueService } from './catalogue.service.js';

describe('shared catalogue enums', () => {
  it.each([
    ['MealType', MealType, mealTypeSchema.options],
    ['DishType', DishType, dishTypeSchema.options],
    ['DishTexture', DishTexture, dishTextureSchema.options],
    ['DishVerification', DishVerification, dishVerificationSchema.options],
    ['Cuisine', Cuisine, cuisineSchema.options],
    ['IngredientCategory', IngredientCategory, ingredientCategorySchema.options],
  ])('%s matches the database enum', (_name, prismaEnum, sharedValues) => {
    expect([...sharedValues].sort()).toEqual(Object.values(prismaEnum).sort());
  });
});

// Needs a migrated and seeded database (pnpm db:deploy && pnpm db:seed).
const hasServices = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

describe.skipIf(!hasServices)('catalogue', () => {
  let app: NestFastifyApplication;
  let catalogue: CatalogueService;
  let prisma: PrismaService;
  let staff: Record<string, string>;
  const createdFamilies: string[] = [];

  beforeAll(async () => {
    let auth: FakeAuthProvider;
    ({ app, auth } = await createTestApp());
    staff = signIn(auth, { staffRole: 'dietitian' }).headers;
    catalogue = app.get(CatalogueService);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.dish.deleteMany({ where: { familyId: { in: createdFamilies } } });
    await app.close();
  });

  /** A throwaway draft dish built from seeded ingredients. */
  async function createTestDish() {
    const yam = await prisma.ingredient.findUniqueOrThrow({ where: { name: 'Yam (raw)' } });
    const dish = await prisma.dish.create({
      data: {
        familyId: '00000000-0000-0000-0000-000000000000',
        name: `Test dish ${Date.now()}`,
        cuisine: 'nigerian',
        mealTypes: ['lunch'],
        dishType: 'main',
        servingUnit: 'plate',
        ingredients: { create: [{ ingredientId: yam.id, gramsPerServing: 150 }] },
      },
    });
    await prisma.dish.update({ where: { id: dish.id }, data: { familyId: dish.id } });
    createdFamilies.push(dish.id);
    return dish;
  }

  it('lists the latest version of every seeded dish', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/ops/dishes', headers: staff });
    expect(res.statusCode).toBe(200);
    expect(res.json<unknown[]>().length).toBeGreaterThanOrEqual(32);
  });

  it('filters by dish type and search text', async () => {
    const swallows = await app.inject({
      method: 'GET',
      url: '/v1/ops/dishes?dishType=swallow',
      headers: staff,
    });
    const names = swallows.json<{ name: string }[]>().map((d) => d.name);
    expect(names).toEqual(expect.arrayContaining(['Eba', 'Amala', 'Pounded yam']));

    const search = await app.inject({
      method: 'GET',
      url: '/v1/ops/dishes?q=egusi',
      headers: staff,
    });
    expect(search.json<{ name: string }[]>().map((d) => d.name)).toEqual(['Egusi soup']);

    const alias = await app.inject({
      method: 'GET',
      url: '/v1/ops/dishes?q=asaro',
      headers: staff,
    });
    expect(alias.json<{ name: string }[]>().map((d) => d.name)).toEqual([
      'Yam porridge with greens',
    ]);
  });

  it('rejects invalid filters', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/ops/dishes?dishType=pizza',
      headers: staff,
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns a dish with ingredients, nutrients, tags and recipes', async () => {
    const [jollof] = await catalogue.listDishes({ q: 'Jollof' });
    const res = await app.inject({
      method: 'GET',
      url: `/v1/ops/dishes/${jollof!.id}`,
      headers: staff,
    });
    expect(res.statusCode).toBe(200);
    const dish = res.json<{
      ingredients: {
        gramsPerServing: number;
        ingredient: { name: string; nutrientProfile: { energyKcal: number } };
      }[];
      tags: { tag: { slug: string } }[];
      recipes: { steps: string }[];
    }>();
    expect(dish.ingredients[0]).toMatchObject({
      gramsPerServing: 70,
      ingredient: { name: 'White rice (raw)', nutrientProfile: { energyKcal: 360 } },
    });
    expect(dish.tags.map((t) => t.tag.slug)).toContain('traditional');
    expect(dish.recipes).toHaveLength(1);
  });

  it('returns 404 for an unknown dish and 400 for a malformed id', async () => {
    const missing = await app.inject({
      method: 'GET',
      url: '/v1/ops/dishes/01900000-0000-7000-8000-000000000000',
      headers: staff,
    });
    expect(missing.statusCode).toBe(404);
    const malformed = await app.inject({
      method: 'GET',
      url: '/v1/ops/dishes/not-a-uuid',
      headers: staff,
    });
    expect(malformed.statusCode).toBe(400);
  });

  it('lists ingredients with nutrients and local units', async () => {
    const ingredients = await app.inject({
      method: 'GET',
      url: '/v1/ops/ingredients',
      headers: staff,
    });
    expect(ingredients.json<unknown[]>().length).toBeGreaterThanOrEqual(46);
    const units = await app.inject({ method: 'GET', url: '/v1/ops/units', headers: staff });
    expect(units.json<{ name: string }[]>().map((u) => u.name)).toContain('derica');
  });

  describe('versioning', () => {
    it('edits a draft in place', async () => {
      const draft = await createTestDish();
      const updated = await catalogue.updateDish(draft.id, { cookMinutes: 40 });
      expect(updated).toMatchObject({ id: draft.id, version: 1, cookMinutes: 40 });
    });

    it('turns an edit of a verified dish into version 2 and leaves version 1 intact', async () => {
      const dietitian = await prisma.user.findUniqueOrThrow({
        where: { email: 'dietitian@example.test' },
      });
      const draft = await createTestDish();
      const v1 = await catalogue.verifyDish(draft.id, dietitian.id);
      expect(v1.verificationStatus).toBe('dietitian_verified');

      const v2 = await catalogue.updateDish(v1.id, {
        cookMinutes: 55,
        ingredients: [
          {
            ingredientId: v1.ingredients[0]!.ingredientId,
            gramsPerServing: 120,
            isOptional: false,
          },
        ],
      });
      expect(v2).toMatchObject({
        familyId: v1.familyId,
        version: 2,
        verificationStatus: 'draft',
        cookMinutes: 55,
      });
      expect(v2.id).not.toBe(v1.id);
      expect(v2.ingredients[0]?.gramsPerServing).toBe(120);

      const original = await catalogue.getDish(v1.id);
      expect(original).toMatchObject({
        version: 1,
        verificationStatus: 'dietitian_verified',
        cookMinutes: 0,
      });
      expect(original.ingredients[0]?.gramsPerServing).toBe(150);

      // The planner keeps using the verified version until version 2 is verified.
      const plannable = await catalogue.listPlannableDishes();
      expect(plannable.find((d) => d.familyId === v1.familyId)?.id).toBe(v1.id);

      await catalogue.verifyDish(v2.id, dietitian.id);
      const afterVerify = await catalogue.listPlannableDishes();
      expect(afterVerify.find((d) => d.familyId === v1.familyId)?.id).toBe(v2.id);
    });

    it('refuses to change an older version or verify a verified dish', async () => {
      const dietitian = await prisma.user.findUniqueOrThrow({
        where: { email: 'dietitian@example.test' },
      });
      const draft = await createTestDish();
      const v1 = await catalogue.verifyDish(draft.id, dietitian.id);
      await catalogue.updateDish(v1.id, { cookMinutes: 10 });

      await expect(catalogue.updateDish(v1.id, { cookMinutes: 20 })).rejects.toThrow(
        /newer version/,
      );
      await expect(catalogue.verifyDish(v1.id, dietitian.id)).rejects.toThrow(/newer version/);
    });

    it('excludes drafts from planning unless explicitly included', async () => {
      const draft = await createTestDish();
      const verifiedOnly = await catalogue.listPlannableDishes();
      expect(verifiedOnly.some((d) => d.id === draft.id)).toBe(false);
      const withDrafts = await catalogue.listPlannableDishes({ includeDrafts: true });
      expect(withDrafts.some((d) => d.id === draft.id)).toBe(true);
    });
  });
});
