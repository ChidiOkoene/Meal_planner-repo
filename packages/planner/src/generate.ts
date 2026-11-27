import { scaleNutrients, sumNutrients } from '@dyjext/nutrition';
import { createEvaluator, type Evaluation, type Slot } from './evaluate.js';
import { allowedDishes, buildMealOptions, type MealOption, toPlannedItems } from './options.js';
import { createRandom, randomInt } from './random.js';
import {
  type MealType,
  type PlannedDay,
  type PlannerInput,
  type PlannerOptions,
  type PlannerResult,
  type ScoreWeights,
  type UnmetRule,
} from './types.js';

export const ENGINE_VERSION = 'planner-1.0.0';

export const DEFAULT_WEIGHTS: ScoreWeights = {
  favourite: 3,
  recentRepeat: 1,
  sameDishNextDay: 2,
  ingredientReuse: 0.05,
  portionDeviation: 1.5,
  longCookingForSelfCook: 1,
  batchReuse: 0.5,
  extraUse: 2,
  tag: { 'high-fibre': 0.5, 'low-gi': 0.5 },
};

/** Hard-rule violations always outweigh any amount of soft preference. */
const HARD_PENALTY = 1000;

const objective = (e: Evaluation) => e.soft - HARD_PENALTY * e.hard;

/**
 * Build a week of meals.
 *
 * 1. Filter out excluded dishes and build every meal option that meets the per-meal limits.
 * 2. Fill meals greedily, the meal types with the fewest options first.
 * 3. Improve with seeded simulated annealing (replace a meal, or swap two meals of a type).
 *
 * Pure and deterministic: the same input and seed always produce the same plan.
 */
export function generatePlan(input: PlannerInput, options: PlannerOptions): PlannerResult {
  const weights: ScoreWeights = {
    ...DEFAULT_WEIGHTS,
    ...options.weights,
    tag: { ...DEFAULT_WEIGHTS.tag, ...options.weights?.tag },
  };
  const random = createRandom(options.seed);
  const iterations = options.iterations ?? 4000;
  const warnings = budgetWarnings(input);

  const dishes = allowedDishes(input.dishes, input.exclusions);
  const mealTypes = [...new Set(input.mealsPerDay)];
  const optionsByMeal = new Map<MealType, MealOption[]>(
    mealTypes.map((mealType) => [
      mealType,
      buildMealOptions(mealType, dishes, input.targets.perMeal[mealType]),
    ]),
  );

  const missing = mealTypes.filter((m) => optionsByMeal.get(m)!.length === 0);
  if (missing.length > 0) {
    return emptyResult(
      input,
      options.seed,
      missing.map((mealType) => ({
        rule: 'no_options',
        mealType,
        message: `No dish fits the ${mealType} limits after exclusions`,
      })),
      warnings,
    );
  }

  const slots: Slot[] = input.dates.flatMap((_, day) =>
    input.mealsPerDay.map((mealType) => ({ day, mealType })),
  );
  const evaluator = createEvaluator(input, slots, weights);
  const assignment: (MealOption | null)[] = slots.map(() => null);

  // 2. Greedy construction, most constrained meal type first.
  const order = slots
    .map((slot, index) => ({ slot, index }))
    .sort(
      (a, b) =>
        optionsByMeal.get(a.slot.mealType)!.length - optionsByMeal.get(b.slot.mealType)!.length ||
        a.slot.day - b.slot.day ||
        a.index - b.index,
    );
  for (const { slot, index } of order) {
    let best: { option: MealOption; value: number } | null = null;
    for (const option of optionsByMeal.get(slot.mealType)!) {
      assignment[index] = option;
      // A tiny seeded jitter breaks ties differently per seed without affecting real preferences.
      const value = objective(evaluator.evaluate(assignment, { partial: true })) + random() * 1e-6;
      if (!best || value > best.value) best = { option, value };
    }
    assignment[index] = best!.option;
  }

  // 3. Simulated annealing.
  let current = objective(evaluator.evaluate(assignment));
  let best = { value: current, assignment: [...assignment] };
  const slotsByMeal = new Map<MealType, number[]>(
    mealTypes.map((m) => [m, slots.flatMap((s, i) => (s.mealType === m ? [i] : []))]),
  );
  const startTemperature = 2;
  const endTemperature = 0.01;

  for (let step = 0; step < iterations; step++) {
    const temperature =
      startTemperature * (endTemperature / startTemperature) ** (step / iterations);
    const i = randomInt(random, slots.length);
    const mealType = slots[i]!.mealType;
    const previous = assignment[i]!;
    let j: number | null = null;

    if (random() < 0.7) {
      const choices = optionsByMeal.get(mealType)!;
      assignment[i] = choices[randomInt(random, choices.length)]!;
    } else {
      const sameType = slotsByMeal.get(mealType)!;
      j = sameType[randomInt(random, sameType.length)]!;
      assignment[i] = assignment[j]!;
      assignment[j] = previous;
    }

    const candidate = objective(evaluator.evaluate(assignment));
    if (candidate >= current || random() < Math.exp((candidate - current) / temperature)) {
      current = candidate;
      if (candidate > best.value) best = { value: candidate, assignment: [...assignment] };
    } else if (j === null) {
      assignment[i] = previous;
    } else {
      assignment[j] = assignment[i]!;
      assignment[i] = previous;
    }
  }

  const final = best.assignment;
  const evaluation = evaluator.evaluate(final);
  const unmet = evaluation.hard > 1e-9 ? evaluator.unmet(final) : [];
  return buildResult(input, options.seed, slots, final, evaluation.soft, unmet, warnings);
}

function buildResult(
  input: PlannerInput,
  seed: string,
  slots: Slot[],
  assignment: (MealOption | null)[],
  score: number,
  unmet: UnmetRule[],
  warnings: string[],
): PlannerResult {
  const eaters = input.eaters ?? 1;
  const days: PlannedDay[] = input.dates.map((date, day) => {
    const meals = slots
      .map((slot, i) => ({ slot, option: assignment[i] }))
      .filter(({ slot, option }) => slot.day === day && option)
      .map(({ slot, option }) => ({
        mealType: slot.mealType,
        items: toPlannedItems(option!),
        nutrients: option!.nutrients,
        costMinor: option!.costMinor === null ? null : option!.costMinor * eaters,
      }));
    return { date, meals, nutrients: sumNutrients(meals.map((m) => m.nutrients)) };
  });
  const allMeals = days.flatMap((d) => d.meals);
  return {
    status: unmet.length === 0 ? 'ok' : 'infeasible',
    engineVersion: ENGINE_VERSION,
    seed,
    days,
    weekNutrients: sumNutrients(days.map((d) => d.nutrients)),
    weekCostMinor: allMeals.some((m) => m.costMinor === null)
      ? null
      : allMeals.reduce((sum, m) => sum + m.costMinor!, 0),
    score: Math.round(score * 100) / 100,
    unmet,
    warnings,
  };
}

function emptyResult(
  input: PlannerInput,
  seed: string,
  unmet: UnmetRule[],
  warnings: string[],
): PlannerResult {
  const zero = scaleNutrients(sumNutrients([]), 1);
  return {
    status: 'infeasible',
    engineVersion: ENGINE_VERSION,
    seed,
    days: input.dates.map((date) => ({ date, meals: [], nutrients: zero })),
    weekNutrients: zero,
    weekCostMinor: null,
    score: 0,
    unmet,
    warnings,
  };
}

function budgetWarnings(input: PlannerInput): string[] {
  if (input.weeklyBudgetMinor == null) return ['No weekly budget set; cost was not checked'];
  if (input.dishes.some((d) => d.costPerServingMinor === null)) {
    return [
      'Some dishes have no price yet; the budget is only checked when every dish in the plan is priced',
    ];
  }
  return [];
}
