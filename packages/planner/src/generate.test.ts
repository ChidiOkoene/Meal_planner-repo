import { performance } from 'node:perf_hooks';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DIABETES_HYPERTENSION_TARGETS,
  fixtureDishes,
  MEALS,
  WEEK,
} from './__fixtures__/catalogue.js';
import { bandViolation } from './bands.js';
import { generatePlan } from './generate.js';
import { type PlannerInput, type PlannerResult } from './types.js';

function baseInput(overrides: Partial<PlannerInput> = {}): PlannerInput {
  return {
    dates: WEEK,
    mealsPerDay: [...MEALS],
    dishes: fixtureDishes(),
    targets: DIABETES_HYPERTENSION_TARGETS,
    ...overrides,
  };
}

const dishNames = (result: PlannerResult) =>
  result.days.flatMap((d) => d.meals.flatMap((m) => m.items.map((i) => i.name)));

describe('generatePlan', () => {
  const input = baseInput();
  const result = generatePlan(input, { seed: 'test-week' });

  it('plans every meal of every day and meets all hard rules', () => {
    expect(result.unmet).toEqual([]);
    expect(result.status).toBe('ok');
    expect(result.days).toHaveLength(7);
    for (const day of result.days) {
      expect(day.meals.map((m) => m.mealType)).toEqual([...MEALS]);
    }
  });

  it('keeps every meal and every day within the limits', () => {
    for (const day of result.days) {
      expect(bandViolation(day.nutrients, input.targets.perDay)).toBe(0);
      for (const meal of day.meals) {
        expect(bandViolation(meal.nutrients, input.targets.perMeal[meal.mealType])).toBe(0);
      }
    }
  });

  it('is deterministic for a seed', () => {
    expect(generatePlan(input, { seed: 'test-week' })).toEqual(result);
    expect(dishNames(generatePlan(input, { seed: 'another-week' }))).not.toEqual(dishNames(result));
  });

  it('pairs soups with swallows and describes portions in local units', () => {
    const soupMeals = result.days
      .flatMap((d) => d.meals)
      .filter((m) => m.items.some((i) => i.dishType === 'soup'));
    expect(soupMeals.length).toBeGreaterThan(0);
    for (const meal of soupMeals) {
      expect(meal.items.map((i) => i.dishType)).toEqual(['soup', 'swallow']);
    }
    const texts = result.days.flatMap((d) =>
      d.meals.flatMap((m) => m.items.map((i) => i.portionText)),
    );
    expect(texts.every((t) => /^(\d|¼|½|¾)/.test(t))).toBe(true);
  });

  it('never cooks the same dish more than twice a week', () => {
    // Non-batch dishes: each appearance is a cook. Batch dishes may appear up to 2× per cook.
    const counts = new Map<string, number>();
    for (const name of dishNames(result)) counts.set(name, (counts.get(name) ?? 0) + 1);
    const batch = new Set(
      fixtureDishes()
        .filter((d) => d.batchCookable)
        .map((d) => d.name),
    );
    for (const [name, count] of counts) {
      expect(count, name).toBeLessThanOrEqual(batch.has(name) ? 4 : 2);
    }
  });

  it('runs in under 2 seconds', () => {
    const start = performance.now();
    generatePlan(input, { seed: 'timing' });
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe('exclusions', () => {
  it('never uses an excluded ingredient or disliked dish', () => {
    const result = generatePlan(
      baseInput({ exclusions: { ingredientIds: ['groundnuts', 'eggs'], familyIds: ['dish-eba'] } }),
      { seed: 'allergy' },
    );
    const dishes = fixtureDishes();
    const used = result.days.flatMap((d) => d.meals.flatMap((m) => m.items));
    for (const item of used) {
      const dish = dishes.find((d) => d.id === item.dishId)!;
      expect(dish.ingredientIds).not.toContain('groundnuts');
      expect(dish.ingredientIds).not.toContain('eggs');
      expect(item.familyId).not.toBe('dish-eba');
    }
  });

  it('uses only soft dishes for chewing difficulty', () => {
    const result = generatePlan(baseInput({ exclusions: { softTextureOnly: true } }), {
      seed: 'soft',
    });
    const soft = new Set(
      fixtureDishes()
        .filter((d) => d.texture === 'soft')
        .map((d) => d.id),
    );
    for (const item of result.days.flatMap((d) => d.meals.flatMap((m) => m.items))) {
      expect(soft.has(item.dishId), item.name).toBe(true);
    }
  });
});

describe('preferences', () => {
  it('chooses a favourite dish that would otherwise not be picked', () => {
    const familiesIn = (r: PlannerResult) =>
      r.days.flatMap((d) => d.meals.flatMap((m) => m.items.map((i) => i.familyId)));
    const baseline = generatePlan(baseInput(), { seed: 'fav' });
    const used = new Set(familiesIn(baseline));
    const unused = fixtureDishes().find(
      (d) => d.mealTypes.includes('snack') && !used.has(d.familyId),
    );
    expect(unused, 'test needs a snack the baseline plan does not use').toBeDefined();

    const withFavourite = generatePlan(
      baseInput({ preferences: { favouriteFamilyIds: [unused!.familyId] } }),
      {
        seed: 'fav',
      },
    );
    const count = familiesIn(withFavourite).filter((id) => id === unused!.familyId).length;
    expect(count).toBeGreaterThan(0);
    // Still within the weekly repeat limit (no-cook snacks: two servings count as one cook).
    expect(count).toBeLessThanOrEqual(unused!.cookMinutes === 0 ? 4 : 2);
  });
});

describe('infeasible requests', () => {
  it('reports a meal type no dish can satisfy', () => {
    const result = generatePlan(
      baseInput({
        targets: {
          ...DIABETES_HYPERTENSION_TARGETS,
          perMeal: { ...DIABETES_HYPERTENSION_TARGETS.perMeal, lunch: { carbsG: { max: 5 } } },
        },
      }),
      { seed: 'impossible' },
    );
    expect(result.status).toBe('infeasible');
    expect(result.unmet).toContainEqual(
      expect.objectContaining({ rule: 'no_options', mealType: 'lunch' }),
    );
  });

  it('reports days whose limits cannot be met', () => {
    const result = generatePlan(
      baseInput({
        targets: { ...DIABETES_HYPERTENSION_TARGETS, perDay: { sodiumMg: { max: 300 } } },
      }),
      { seed: 'salt', iterations: 500 },
    );
    expect(result.status).toBe('infeasible');
    expect(result.unmet[0]).toMatchObject({ rule: 'day_limit' });
    expect(result.unmet[0]!.message).toMatch(/sodiumMg/);
  });
});

describe('budget', () => {
  it('stays within a sufficient budget and reports the cost', () => {
    const result = generatePlan(
      baseInput({
        dishes: fixtureDishes({ costPerServingMinor: 50_000 }),
        weeklyBudgetMinor: 4_000_000,
      }),
      {
        seed: 'budget',
      },
    );
    expect(result.status).toBe('ok');
    expect(result.weekCostMinor).not.toBeNull();
    expect(result.weekCostMinor!).toBeLessThanOrEqual(4_000_000);
    expect(result.warnings).toEqual([]);
  });

  it('is infeasible when the budget is too small', () => {
    const result = generatePlan(
      baseInput({
        dishes: fixtureDishes({ costPerServingMinor: 50_000 }),
        weeklyBudgetMinor: 100_000,
      }),
      {
        seed: 'budget',
        iterations: 500,
      },
    );
    expect(result.status).toBe('infeasible');
    expect(result.unmet.map((u) => u.rule)).toContain('budget');
  });

  it('warns when the budget cannot be checked', () => {
    const result = generatePlan(baseInput({ weeklyBudgetMinor: 4_000_000 }), {
      seed: 'budget',
      iterations: 200,
    });
    expect(result.warnings[0]).toMatch(/no price/);
  });
});

describe('properties', () => {
  it('every plan reported ok meets every per-meal and per-day limit', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 12 }), (seed) => {
        const input = baseInput();
        const result = generatePlan(input, { seed, iterations: 1500 });
        if (result.status !== 'ok') return;
        for (const day of result.days) {
          expect(bandViolation(day.nutrients, input.targets.perDay)).toBe(0);
          for (const meal of day.meals) {
            expect(bandViolation(meal.nutrients, input.targets.perMeal[meal.mealType])).toBe(0);
          }
        }
      }),
      { numRuns: 25 },
    );
  });
});
