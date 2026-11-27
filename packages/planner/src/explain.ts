import { type Nutrients, roundNutrients } from '@dyjext/nutrition';
import { LIMITED_NUTRIENTS } from './bands.js';
import { type CatalogueDish } from './catalogue.js';
import {
  type LimitedNutrient,
  type MealType,
  type NutrientBands,
  type PlannerPreferences,
  type PlannerTargets,
} from './types.js';
import { type PlanToValidate, type RecomputedPlan } from './validate.js';

export const NUTRIENT_LABELS: Record<LimitedNutrient, { label: string; unit: string }> = {
  energyKcal: { label: 'Energy', unit: 'kcal' },
  proteinG: { label: 'Protein', unit: 'g' },
  carbsG: { label: 'Carbohydrates', unit: 'g' },
  fatG: { label: 'Fat', unit: 'g' },
  fibreG: { label: 'Fibre', unit: 'g' },
  sodiumMg: { label: 'Sodium', unit: 'mg' },
};

const TAG_REASONS: Record<string, string> = {
  'low-gi': 'Lower glycaemic index: raises blood sugar more slowly',
  'high-fibre': 'High in fibre',
  'high-protein': 'High in protein',
  traditional: 'A familiar traditional dish',
};

/** How close a value is to its limit. "near_limit" means within 10% of a minimum or maximum. */
export type CheckStatus = 'within' | 'near_limit' | 'outside';

export interface LimitCheck {
  nutrient: LimitedNutrient;
  label: string;
  unit: string;
  value: number;
  min?: number;
  max?: number;
  status: CheckStatus;
}

export interface ItemExplanation {
  dishId: string;
  name: string;
  portion: number;
  reasons: string[];
}

export interface PlanExplanation {
  days: {
    date: string;
    nutrients: Nutrients;
    checks: LimitCheck[];
    meals: { mealType: MealType; checks: LimitCheck[]; items: ItemExplanation[] }[];
  }[];
  /** Limits that were close on several days: what most shaped this plan. */
  tightLimits: string[];
  summary: string[];
}

/**
 * Explain a validated plan for a dietitian: totals against limits, why each dish is there,
 * and which limits constrained the plan. Uses the validator's recomputed nutrients.
 */
export function explainPlan(
  plan: PlanToValidate,
  recomputed: RecomputedPlan,
  context: {
    catalogue: CatalogueDish[];
    targets: PlannerTargets;
    preferences?: PlannerPreferences;
  },
): PlanExplanation {
  const byId = new Map(context.catalogue.map((d) => [d.id, d]));
  const favourites = new Set(context.preferences?.favouriteFamilyIds ?? []);
  const familyDays = new Map<string, number[]>();
  plan.days.forEach((day, index) => {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        const familyId = byId.get(item.dishId)?.familyId;
        if (familyId) familyDays.set(familyId, [...(familyDays.get(familyId) ?? []), index]);
      }
    }
  });

  const days = plan.days.map((day, dayIndex) => {
    const totals = recomputed.days[dayIndex]!;
    return {
      date: day.date,
      nutrients: roundNutrients(totals.nutrients),
      checks: checkLimits(totals.nutrients, context.targets.perDay),
      meals: day.meals.map((meal, mealIndex) => ({
        mealType: meal.mealType,
        checks: checkLimits(
          totals.meals[mealIndex]!.nutrients,
          context.targets.perMeal[meal.mealType],
        ),
        items: meal.items.map((item): ItemExplanation => {
          const dish = byId.get(item.dishId);
          if (!dish)
            return {
              dishId: item.dishId,
              name: 'Unknown dish',
              portion: item.portion,
              reasons: [],
            };
          const partner = meal.items.find((other) => other.dishId !== item.dishId);
          return {
            dishId: dish.id,
            name: dish.name,
            portion: item.portion,
            reasons: reasonsFor(dish, item.portion, {
              mealType: meal.mealType,
              favourite: favourites.has(dish.familyId),
              partnerName: partner ? byId.get(partner.dishId)?.name : undefined,
              days: familyDays.get(dish.familyId) ?? [],
              dayIndex,
              dates: plan.days.map((d) => d.date),
            }),
          };
        }),
      })),
    };
  });

  const tightLimits = summariseTightLimits(
    days.map((d) => d.checks),
    days.length,
  );
  const summary = [
    `${days.length} days, ${days.reduce((n, d) => n + d.meals.length, 0)} meals, ${familyDays.size} different dishes.`,
    ...tightLimits,
  ];
  return { days, tightLimits, summary };
}

export function checkLimits(nutrients: Nutrients, bands: NutrientBands | undefined): LimitCheck[] {
  if (!bands) return [];
  return LIMITED_NUTRIENTS.flatMap((nutrient) => {
    const band = bands[nutrient];
    if (!band) return [];
    const value = nutrients[nutrient];
    let status: CheckStatus = 'within';
    if (
      (band.max !== undefined && value > band.max + 1e-9) ||
      (band.min !== undefined && value < band.min - 1e-9)
    ) {
      status = 'outside';
    } else if (
      (band.max !== undefined && value >= band.max * 0.9) ||
      (band.min !== undefined && value <= band.min * 1.1)
    ) {
      status = 'near_limit';
    }
    const { label, unit } = NUTRIENT_LABELS[nutrient];
    return [
      {
        nutrient,
        label,
        unit,
        value: Math.round(value * 10) / 10,
        min: band.min,
        max: band.max,
        status,
      },
    ];
  });
}

function reasonsFor(
  dish: CatalogueDish,
  portion: number,
  context: {
    mealType: MealType;
    favourite: boolean;
    partnerName?: string;
    days: number[];
    dayIndex: number;
    dates: string[];
  },
): string[] {
  const reasons: string[] = [];
  if (context.favourite) reasons.push('A favourite');
  if (dish.dishType === 'soup' && context.partnerName)
    reasons.push(`Eaten with ${context.partnerName}`);
  if (portion < 1)
    reasons.push(`Smaller portion (${portion}×) to stay within the ${context.mealType} limits`);
  if (portion > 1)
    reasons.push(`Larger portion (${portion}×) to meet the ${context.mealType} minimums`);

  if (dish.batchCookable) {
    const earlier = context.days.filter((d) => d < context.dayIndex);
    const previous = earlier.at(-1);
    if (previous !== undefined && context.dayIndex - previous === 1) {
      reasons.push(`Leftovers from ${context.dates[previous]}`);
    } else if (context.days.some((d) => d - context.dayIndex === 1)) {
      reasons.push('Cook enough for tomorrow too');
    }
  }
  for (const tag of dish.tags) {
    const reason = TAG_REASONS[tag];
    if (reason) reasons.push(reason);
  }
  return reasons;
}

function summariseTightLimits(dayChecks: LimitCheck[][], dayCount: number): string[] {
  const counts = new Map<string, { check: LimitCheck; days: number }>();
  for (const checks of dayChecks) {
    for (const check of checks) {
      if (check.status !== 'near_limit') continue;
      const nearMax = check.max !== undefined && check.value >= check.max * 0.9;
      const key = `${check.nutrient}:${nearMax ? 'max' : 'min'}`;
      const entry = counts.get(key) ?? { check, days: 0 };
      entry.days++;
      counts.set(key, entry);
    }
  }
  return [...counts.entries()]
    .filter(([, { days }]) => days >= 2)
    .sort((a, b) => b[1].days - a[1].days)
    .map(([key, { check, days }]) => {
      const isMax = key.endsWith(':max');
      const limit = isMax ? check.max : check.min;
      return `Daily ${check.label.toLowerCase()} was close to the ${isMax ? 'maximum' : 'minimum'} of ${limit} ${check.unit} on ${days} of ${dayCount} days.`;
    });
}
