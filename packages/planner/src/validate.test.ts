import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DIABETES_HYPERTENSION_TARGETS,
  fixtureCatalogue,
  MEALS,
  WEEK,
} from './__fixtures__/catalogue.js';
import { toPlannerDish } from './catalogue.js';
import { explainPlan } from './explain.js';
import { generatePlan } from './generate.js';
import {
  type PlannerExclusions,
  type PlannerInput,
  type PlannerResult,
  type PlannerTargets,
} from './types.js';
import { type PlanToValidate, validatePlan } from './validate.js';

const catalogue = fixtureCatalogue();

function plan(input: Partial<PlannerInput> = {}, seed = 'validator'): PlannerResult {
  return generatePlan(
    {
      dates: WEEK,
      mealsPerDay: [...MEALS],
      dishes: input.dishes ?? catalogue.map(toPlannerDish),
      targets: DIABETES_HYPERTENSION_TARGETS,
      ...input,
    },
    { seed, ...(input ? {} : {}) },
  );
}

const asValidatable = (result: PlannerResult): PlanToValidate => ({
  days: result.days.map((d) => ({
    date: d.date,
    meals: d.meals.map((m) => ({
      mealType: m.mealType,
      items: m.items.map((i) => ({ dishId: i.dishId, portion: i.portion })),
    })),
  })),
});

const clone = (p: PlanToValidate): PlanToValidate => structuredClone(p);

describe('validatePlan', () => {
  const generated = plan();
  const valid = asValidatable(generated);
  const context = { catalogue, targets: DIABETES_HYPERTENSION_TARGETS };

  it('accepts a plan the engine reported as ok', () => {
    expect(generated.status).toBe('ok');
    const result = validatePlan(valid, context);
    expect(result.problems).toEqual([]);
    expect(result.status).toBe('ok');
  });

  it('recomputes nutrients independently and agrees with the engine', () => {
    const result = validatePlan(valid, context);
    result.recomputed.days.forEach((day, i) => {
      expect(day.nutrients.carbsG).toBeCloseTo(generated.days[i]!.nutrients.carbsG, 6);
      expect(day.nutrients.sodiumMg).toBeCloseTo(generated.days[i]!.nutrients.sodiumMg, 6);
    });
  });

  it('fails a plan whose portion pushes a meal over its limit', () => {
    const tampered = clone(valid);
    const lunch = tampered.days[0]!.meals.find((m) => m.mealType === 'lunch')!;
    for (const item of lunch.items) item.portion = 1.5;
    const result = validatePlan(tampered, context);
    expect(result.status).toBe('failed');
    expect(result.problems).toContainEqual(
      expect.objectContaining({ rule: 'meal_limit', mealType: 'lunch', date: WEEK[0] }),
    );
  });

  it('fails a plan containing an excluded ingredient', () => {
    const exclusions: PlannerExclusions = { ingredientIds: ['groundnuts'] };
    const tampered = clone(valid);
    tampered.days[0]!.meals.find((m) => m.mealType === 'snack')!.items = [
      { dishId: 'dish-roasted-groundnuts', portion: 1 },
    ];
    const result = validatePlan(tampered, { ...context, exclusions });
    expect(result.problems).toContainEqual(
      expect.objectContaining({ rule: 'excluded_ingredient', dishId: 'dish-roasted-groundnuts' }),
    );
  });

  it('fails unverified, unknown, misplaced and oddly portioned dishes', () => {
    const tampered = clone(valid);
    const breakfast = tampered.days[1]!.meals.find((m) => m.mealType === 'breakfast')!;
    breakfast.items = [{ dishId: 'dish-eba', portion: 1.1 }];
    tampered.days[2]!.meals[0]!.items.push({ dishId: 'dish-does-not-exist', portion: 1 });
    const drafts = catalogue.map((d) =>
      d.id === 'dish-eba' ? { ...d, verificationStatus: 'draft' as const } : d,
    );
    const rules = validatePlan(tampered, { ...context, catalogue: drafts }).problems.map(
      (p) => p.rule,
    );
    expect(rules).toEqual(
      expect.arrayContaining([
        'dish_not_verified',
        'meal_type_mismatch',
        'invalid_portion',
        'unknown_dish',
      ]),
    );
  });

  it('treats drafts as warnings only when previews allow them', () => {
    const drafts = fixtureCatalogue({ status: 'draft' });
    expect(validatePlan(valid, { ...context, catalogue: drafts }).status).toBe('failed');
    const preview = validatePlan(valid, { ...context, catalogue: drafts, allowDrafts: true });
    expect(preview.status).toBe('warnings');
    expect(preview.problems.every((p) => p.rule === 'draft_dish')).toBe(true);
  });

  it('fails a dish cooked more often than allowed', () => {
    const tampered = clone(valid);
    for (const day of tampered.days) {
      day.meals.find((m) => m.mealType === 'snack')!.items = [
        { dishId: 'dish-orange', portion: 1 },
      ];
    }
    const result = validatePlan(tampered, context);
    expect(result.problems).toContainEqual(
      expect.objectContaining({ rule: 'repeat_limit', dishId: 'dish-orange' }),
    );
  });

  it('checks the budget only when every dish is priced', () => {
    const priced = fixtureCatalogue({ costPerServingMinor: 50_000 });
    expect(
      validatePlan(valid, { ...context, catalogue: priced, weeklyBudgetMinor: 100_000 }).problems,
    ).toContainEqual(expect.objectContaining({ rule: 'budget', severity: 'error' }));
    expect(validatePlan(valid, { ...context, weeklyBudgetMinor: 100_000 }).problems).toContainEqual(
      expect.objectContaining({ rule: 'budget_unchecked', severity: 'warning' }),
    );
  });

  it('warns when an ingredient has no nutrient data', () => {
    const incomplete = catalogue.map((d) =>
      d.id === 'dish-eba'
        ? { ...d, ingredients: d.ingredients.map((i) => ({ ...i, per100g: null })) }
        : d,
    );
    const withEba = clone(valid);
    withEba.days[0]!.meals.find((m) => m.mealType === 'dinner')!.items = [
      { dishId: 'dish-egusi-soup', portion: 1 },
      { dishId: 'dish-eba', portion: 1 },
    ];
    const result = validatePlan(withEba, { ...context, catalogue: incomplete });
    expect(result.problems).toContainEqual(
      expect.objectContaining({ rule: 'missing_nutrients', severity: 'warning' }),
    );
  });
});

describe('explainPlan', () => {
  const generated = plan({ preferences: { favouriteFamilyIds: ['dish-efo-riro'] } }, 'explain');
  const validatable = asValidatable(generated);
  const validation = validatePlan(validatable, {
    catalogue,
    targets: DIABETES_HYPERTENSION_TARGETS,
  });
  const explanation = explainPlan(validatable, validation.recomputed, {
    catalogue,
    targets: DIABETES_HYPERTENSION_TARGETS,
    preferences: { favouriteFamilyIds: ['dish-efo-riro'] },
  });

  it('checks every daily limit with a readable label', () => {
    const day = explanation.days[0]!;
    expect(day.checks.map((c) => c.label)).toEqual([
      'Energy',
      'Protein',
      'Carbohydrates',
      'Fibre',
      'Sodium',
    ]);
    expect(day.checks.every((c) => c.status !== 'outside')).toBe(true);
  });

  it('gives reasons for dishes', () => {
    const reasons = explanation.days.flatMap((d) =>
      d.meals.flatMap((m) => m.items.flatMap((i) => i.reasons)),
    );
    expect(reasons.length).toBeGreaterThan(0);
    const efo = explanation.days
      .flatMap((d) => d.meals.flatMap((m) => m.items))
      .find((i) => i.dishId === 'dish-efo-riro');
    expect(efo?.reasons).toContain('A favourite');
    expect(efo?.reasons.some((r) => r.startsWith('Eaten with'))).toBe(true);
  });

  it('summarises the plan in plain sentences', () => {
    expect(explanation.summary[0]).toMatch(/^7 days, 28 meals, \d+ different dishes\.$/);
    for (const line of explanation.tightLimits)
      expect(line).toMatch(/^Daily .+ on \d of 7 days\.$/);
  });
});

/**
 * The guarantee #25 exists for: whatever the inputs, a plan the engine calls "ok" passes the
 * independent validator. Default 200 random cases; set PLANNER_PROPERTY_RUNS for longer runs.
 */
describe('engine and validator agree', () => {
  const runs = Number(process.env.PLANNER_PROPERTY_RUNS ?? 200);
  const ingredientIds = [
    ...new Set(catalogue.flatMap((d) => d.ingredients.map((i) => i.ingredientId))),
  ];

  const targetsArb: fc.Arbitrary<PlannerTargets> = fc
    .record({
      mealCarbMax: fc.integer({ min: 45, max: 80 }),
      dayCarbMax: fc.integer({ min: 160, max: 280 }),
      daySodiumMax: fc.integer({ min: 1500, max: 3000 }),
      dayFibreMin: fc.integer({ min: 0, max: 25 }),
    })
    .map(({ mealCarbMax, dayCarbMax, daySodiumMax, dayFibreMin }) => ({
      perMeal: {
        breakfast: { carbsG: { max: mealCarbMax } },
        lunch: { carbsG: { min: 25, max: mealCarbMax }, sodiumMg: { max: 1000 } },
        dinner: { carbsG: { min: 25, max: mealCarbMax }, sodiumMg: { max: 1000 } },
        snack: { carbsG: { max: 25 } },
      },
      perDay: {
        carbsG: { max: dayCarbMax },
        sodiumMg: { max: daySodiumMax },
        fibreG: { min: dayFibreMin },
      },
    }));

  it(
    `never reports ok for a plan the validator rejects (${runs} random cases)`,
    { timeout: 600_000 },
    () => {
      let okPlans = 0;
      fc.assert(
        fc.property(
          fc.string({ maxLength: 10 }),
          targetsArb,
          fc.subarray(ingredientIds, { maxLength: 3 }),
          fc.boolean(),
          fc.option(fc.integer({ min: 300_000, max: 2_000_000 }), { nil: null }),
          (seed, targets, excluded, soft, budget) => {
            const priced = fixtureCatalogue({ costPerServingMinor: 20_000 });
            const exclusions = { ingredientIds: excluded, softTextureOnly: soft };
            const result = generatePlan(
              {
                dates: WEEK,
                mealsPerDay: [...MEALS],
                dishes: priced.map(toPlannerDish),
                targets,
                exclusions,
                weeklyBudgetMinor: budget,
              },
              { seed, iterations: 300 },
            );
            if (result.status !== 'ok') return;
            okPlans++;
            const validation = validatePlan(asValidatable(result), {
              catalogue: priced,
              targets,
              exclusions,
              weeklyBudgetMinor: budget,
            });
            expect(validation.problems.filter((p) => p.severity === 'error')).toEqual([]);
          },
        ),
        { numRuns: runs },
      );
      expect(okPlans).toBeGreaterThan(0);
    },
  );
});
