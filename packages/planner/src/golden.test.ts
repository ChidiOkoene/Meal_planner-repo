import { describe, expect, it } from 'vitest';
import {
  DIABETES_HYPERTENSION_TARGETS,
  fixtureDishes,
  MEALS,
  WEEK,
} from './__fixtures__/catalogue.js';
import { ENGINE_VERSION, generatePlan } from './generate.js';
import { type PlannerInput, type PlannerResult } from './types.js';

/**
 * Golden plans for five representative recipients. If the engine or its weights change,
 * these snapshots change: review the new plans, bump ENGINE_VERSION, then update with
 * `pnpm --filter @dyjext/planner test -u`.
 */
const base: PlannerInput = {
  dates: WEEK,
  mealsPerDay: [...MEALS],
  dishes: fixtureDishes(),
  targets: DIABETES_HYPERTENSION_TARGETS,
};

const recipients: Record<string, PlannerInput> = {
  'type 2 diabetes and hypertension': base,
  'type 2 diabetes only': {
    ...base,
    targets: { ...base.targets, perDay: { ...base.targets.perDay, sodiumMg: { max: 3000 } } },
  },
  'hypertension only': {
    ...base,
    targets: {
      perMeal: { lunch: { sodiumMg: { max: 800 } }, dinner: { sodiumMg: { max: 800 } } },
      perDay: {
        sodiumMg: { max: 2000 },
        energyKcal: { min: 1300, max: 2200 },
        fibreG: { min: 20 },
      },
    },
  },
  // Expected to be infeasible: the catalogue has only two soft breakfasts, which can't fill
  // seven days within the repeat limit. The engine must report this, not break a rule.
  'chewing difficulty (expected infeasible: too few soft breakfasts)': {
    ...base,
    exclusions: { softTextureOnly: true },
  },
  'groundnut allergy, cooks for self': {
    ...base,
    exclusions: { ingredientIds: ['groundnuts'] },
    preferences: { cooking: 'self', favouriteFamilyIds: ['dish-okra-soup'] },
  },
};

const summarise = (result: PlannerResult) => ({
  status: result.status,
  unmet: result.unmet.map((u) => u.message),
  days: result.days.map(
    (d) =>
      `${d.date}: ${d.meals.map((m) => `${m.mealType}=${m.items.map((i) => i.portionText).join(' + ')}`).join(' | ')}`,
  ),
});

describe(`golden plans (${ENGINE_VERSION})`, () => {
  for (const [name, input] of Object.entries(recipients)) {
    it(name, () => {
      const result = generatePlan(input, { seed: `golden:${name}` });
      expect(result.status).toBe(name.includes('expected infeasible') ? 'infeasible' : 'ok');
      expect(summarise(result)).toMatchSnapshot();
    });
  }
});
