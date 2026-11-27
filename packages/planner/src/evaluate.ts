import { type Nutrients, sumNutrients } from '@dyjext/nutrition';
import { bandViolation, describeViolations, maxViolation } from './bands.js';
import { type MealOption } from './options.js';
import { type MealType, type PlannerInput, type ScoreWeights, type UnmetRule } from './types.js';

export interface Slot {
  day: number;
  mealType: MealType;
}

export interface Evaluation {
  /** Sum of hard-rule violations. Zero means every hard rule holds. */
  hard: number;
  /** Soft preference score; higher is better. */
  soft: number;
}

export interface Evaluator {
  evaluate(assignment: (MealOption | null)[], options?: { partial?: boolean }): Evaluation;
  unmet(assignment: (MealOption | null)[]): UnmetRule[];
}

/**
 * Hard rules: per-day limits, cooks per dish per week, budget.
 * Per-meal limits are already guaranteed by how meal options are built.
 */
export function createEvaluator(
  input: PlannerInput,
  slots: Slot[],
  weights: ScoreWeights,
): Evaluator {
  const maxCooks = input.maxCooksPerDishPerWeek ?? 2;
  const eaters = input.eaters ?? 1;
  const budget = input.weeklyBudgetMinor ?? null;
  const favourites = new Set(input.preferences?.favouriteFamilyIds ?? []);
  const recentCounts = countBy(input.preferences?.recentFamilyIds ?? []);
  const selfCook = input.preferences?.cooking === 'self';
  const dayCount = input.dates.length;

  function dayTotals(assignment: (MealOption | null)[]): Nutrients[] {
    const perDay: Nutrients[][] = Array.from({ length: dayCount }, () => []);
    assignment.forEach((option, i) => {
      if (option) perDay[slots[i]!.day]!.push(option.nutrients);
    });
    return perDay.map((items) => sumNutrients(items));
  }

  /** Day indexes each dish family appears on, plus batch information. */
  function appearances(assignment: (MealOption | null)[]) {
    const byFamily = new Map<string, { days: number[]; batchDays: number | null }>();
    assignment.forEach((option, i) => {
      if (!option) return;
      for (const { dish } of option.items) {
        const entry = byFamily.get(dish.familyId) ?? {
          days: [],
          // A batch covers at most two days of eating, even if it keeps longer, for variety.
          batchDays: dish.batchCookable ? Math.min(dish.keepsDays ?? 1, 2) : null,
        };
        entry.days.push(slots[i]!.day);
        byFamily.set(dish.familyId, entry);
      }
    });
    return byFamily;
  }

  /** Cooking sessions: batch dishes eaten within their batch window count once. */
  function cooks(days: number[], batchDays: number | null): { cooks: number; reused: number } {
    if (batchDays === null) return { cooks: days.length, reused: 0 };
    const sorted = [...days].sort((a, b) => a - b);
    let cooksCount = 0;
    let reused = 0;
    let batchStart = -Infinity;
    let usesInBatch = 0;
    for (const day of sorted) {
      if (day - batchStart >= batchDays || usesInBatch >= batchDays) {
        cooksCount++;
        batchStart = day;
        usesInBatch = 1;
      } else {
        reused++;
        usesInBatch++;
      }
    }
    return { cooks: cooksCount, reused };
  }

  function weekCost(assignment: (MealOption | null)[]): number | null {
    let total = 0;
    for (const option of assignment) {
      if (!option) continue;
      if (option.costMinor === null) return null;
      total += option.costMinor * eaters;
    }
    return total;
  }

  function evaluate(
    assignment: (MealOption | null)[],
    options: { partial?: boolean } = {},
  ): Evaluation {
    let hard = 0;

    for (const totals of dayTotals(assignment)) {
      hard += options.partial
        ? maxViolation(totals, input.targets.perDay)
        : bandViolation(totals, input.targets.perDay);
    }

    let soft = 0;
    for (const [familyId, entry] of appearances(assignment)) {
      const { cooks: cookCount, reused } = cooks(entry.days, entry.batchDays);
      hard += Math.max(0, cookCount - maxCooks);
      soft += reused * weights.batchReuse;
      soft -= Math.max(0, entry.days.length - 2) * weights.extraUse;

      const sorted = [...entry.days].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i]! - sorted[i - 1]!;
        // Same dish twice in a day, or on consecutive days when not a batch.
        if (gap === 0 || (gap === 1 && entry.batchDays === null)) soft -= weights.sameDishNextDay;
      }
      soft -= (recentCounts.get(familyId) ?? 0) * entry.days.length * weights.recentRepeat;
      if (favourites.has(familyId)) soft += entry.days.length * weights.favourite;
    }

    if (budget !== null) {
      const cost = weekCost(assignment);
      if (cost !== null && cost > budget) hard += (cost - budget) / Math.max(budget, 1);
    }

    const ingredientUses = new Map<string, number>();
    for (const option of assignment) {
      if (!option) continue;
      soft -= option.portionDeviation * weights.portionDeviation;
      for (const id of option.ingredientIds)
        ingredientUses.set(id, (ingredientUses.get(id) ?? 0) + 1);
      for (const { dish } of option.items) {
        for (const tag of dish.tags) soft += weights.tag[tag] ?? 0;
        if (selfCook && dish.cookMinutes > 60) soft -= weights.longCookingForSelfCook;
      }
    }
    for (const uses of ingredientUses.values()) soft += (uses - 1) * weights.ingredientReuse;

    return { hard, soft };
  }

  function unmet(assignment: (MealOption | null)[]): UnmetRule[] {
    const rules: UnmetRule[] = [];
    dayTotals(assignment).forEach((totals, day) => {
      const problems = describeViolations(totals, input.targets.perDay);
      if (problems.length > 0) {
        rules.push({
          rule: 'day_limit',
          date: input.dates[day],
          message: `Day total outside limits: ${problems.join(', ')}`,
        });
      }
    });
    for (const [familyId, entry] of appearances(assignment)) {
      const { cooks: cookCount } = cooks(entry.days, entry.batchDays);
      if (cookCount > maxCooks) {
        const name =
          assignment.flatMap((o) => o?.items ?? []).find((i) => i.dish.familyId === familyId)?.dish
            .name ?? familyId;
        rules.push({
          rule: 'repeat_limit',
          message: `${name} is cooked ${cookCount} times; the limit is ${maxCooks}`,
        });
      }
    }
    if (budget !== null) {
      const cost = weekCost(assignment);
      if (cost !== null && cost > budget) {
        rules.push({
          rule: 'budget',
          message: `Estimated cost ${Math.round(cost)} is over the budget of ${budget}`,
        });
      }
    }
    return rules;
  }

  return { evaluate, unmet };
}

function countBy(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}
