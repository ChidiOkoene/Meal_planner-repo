import { dishNutrition, type Nutrients, scaleNutrients, sumNutrients } from '@dyjext/nutrition';
import { describeViolations } from './bands.js';
import { type CatalogueDish } from './catalogue.js';
import { PORTIONS } from './options.js';
import { type MealType, type PlannerExclusions, type PlannerTargets } from './types.js';

/** The part of a plan the validator needs: which dish version, how much, at which meal. */
export interface PlanToValidate {
  days: {
    date: string;
    meals: { mealType: MealType; items: { dishId: string; portion: number }[] }[];
  }[];
}

export interface ValidationContext {
  /** Every dish version the plan may reference. */
  catalogue: CatalogueDish[];
  targets: PlannerTargets;
  exclusions?: PlannerExclusions;
  weeklyBudgetMinor?: number | null;
  eaters?: number;
  maxCooksPerDishPerWeek?: number;
  /** Allow draft dishes (development previews only). Real plans need verified dishes. */
  allowDrafts?: boolean;
}

export type ProblemRule =
  | 'unknown_dish'
  | 'dish_not_verified'
  | 'meal_type_mismatch'
  | 'invalid_portion'
  | 'excluded_ingredient'
  | 'excluded_dish'
  | 'texture'
  | 'meal_limit'
  | 'day_limit'
  | 'repeat_limit'
  | 'budget'
  | 'missing_nutrients'
  | 'budget_unchecked'
  | 'draft_dish'
  | 'empty_meal';

export interface Problem {
  severity: 'error' | 'warning';
  rule: ProblemRule;
  message: string;
  date?: string;
  mealType?: MealType;
  dishId?: string;
}

export interface RecomputedPlan {
  days: {
    date: string;
    nutrients: Nutrients;
    meals: { mealType: MealType; nutrients: Nutrients }[];
  }[];
  weekNutrients: Nutrients;
  /** Null when any dish in the plan has no price. */
  weekCostMinor: number | null;
}

export interface ValidationResult {
  /** `ok`: send-ready. `warnings`: needs a dietitian's review. `failed`: must not be sent. */
  status: 'ok' | 'warnings' | 'failed';
  problems: Problem[];
  recomputed: RecomputedPlan;
}

const VALID_PORTIONS = new Set<number>(PORTIONS);

/**
 * Check a plan against every hard rule, recomputing nutrients and cost from the catalogue's
 * raw ingredient data. Deliberately shares no state or results with the engine.
 */
export function validatePlan(plan: PlanToValidate, context: ValidationContext): ValidationResult {
  const problems: Problem[] = [];
  const byId = new Map(context.catalogue.map((d) => [d.id, d]));
  const badIngredients = new Set(context.exclusions?.ingredientIds ?? []);
  const badFamilies = new Set(context.exclusions?.familyIds ?? []);
  const eaters = context.eaters ?? 1;
  const maxCooks = context.maxCooksPerDishPerWeek ?? 2;
  const usage = new Map<string, { dish: CatalogueDish; days: number[] }>();
  let weekCost: number | null = 0;
  const missingNutrients = new Set<string>();

  const days = plan.days.map((day, dayIndex) => {
    const meals = day.meals.map((meal) => {
      const where = { date: day.date, mealType: meal.mealType };
      if (meal.items.length === 0) {
        problems.push({
          severity: 'error',
          rule: 'empty_meal',
          message: `${meal.mealType} has no dishes`,
          ...where,
        });
      }
      const itemNutrients: Nutrients[] = [];

      for (const item of meal.items) {
        const dish = byId.get(item.dishId);
        if (!dish) {
          problems.push({
            severity: 'error',
            rule: 'unknown_dish',
            message: `Unknown dish ${item.dishId}`,
            ...where,
            dishId: item.dishId,
          });
          weekCost = null;
          continue;
        }
        const at = { ...where, dishId: dish.id };

        if (dish.verificationStatus === 'retired') {
          problems.push({
            severity: 'error',
            rule: 'dish_not_verified',
            message: `${dish.name} is retired`,
            ...at,
          });
        } else if (dish.verificationStatus === 'draft') {
          problems.push(
            context.allowDrafts
              ? {
                  severity: 'warning',
                  rule: 'draft_dish',
                  message: `${dish.name} is not dietitian-verified yet`,
                  ...at,
                }
              : {
                  severity: 'error',
                  rule: 'dish_not_verified',
                  message: `${dish.name} is not dietitian-verified`,
                  ...at,
                },
          );
        }
        if (!dish.mealTypes.includes(meal.mealType)) {
          problems.push({
            severity: 'error',
            rule: 'meal_type_mismatch',
            message: `${dish.name} is not a ${meal.mealType} dish`,
            ...at,
          });
        }
        if (!VALID_PORTIONS.has(item.portion)) {
          problems.push({
            severity: 'error',
            rule: 'invalid_portion',
            message: `${dish.name}: portion ${item.portion} is not between 0.5 and 1.5 in quarter steps`,
            ...at,
          });
        }
        if (badFamilies.has(dish.familyId)) {
          problems.push({
            severity: 'error',
            rule: 'excluded_dish',
            message: `${dish.name} is on the recipient's exclusion list`,
            ...at,
          });
        }
        for (const ingredient of dish.ingredients) {
          if (!ingredient.isOptional && badIngredients.has(ingredient.ingredientId)) {
            problems.push({
              severity: 'error',
              rule: 'excluded_ingredient',
              message: `${dish.name} contains ${ingredient.name}, which is excluded`,
              ...at,
            });
          }
        }
        if (context.exclusions?.softTextureOnly && dish.texture !== 'soft') {
          problems.push({
            severity: 'error',
            rule: 'texture',
            message: `${dish.name} is not soft enough`,
            ...at,
          });
        }

        const nutrition = dishNutrition(dish.ingredients);
        for (const name of nutrition.missingProfiles) missingNutrients.add(name);
        itemNutrients.push(scaleNutrients(nutrition.perServing, item.portion));

        if (weekCost !== null) {
          weekCost =
            dish.costPerServingMinor === null
              ? null
              : weekCost + dish.costPerServingMinor * item.portion * eaters;
        }

        const entry = usage.get(dish.familyId) ?? { dish, days: [] };
        entry.days.push(dayIndex);
        usage.set(dish.familyId, entry);
      }

      const nutrients = sumNutrients(itemNutrients);
      const violations = describeViolations(nutrients, context.targets.perMeal[meal.mealType]);
      if (violations.length > 0) {
        problems.push({
          severity: 'error',
          rule: 'meal_limit',
          message: `${meal.mealType} outside limits: ${violations.join(', ')}`,
          ...where,
        });
      }
      return { mealType: meal.mealType, nutrients };
    });

    const nutrients = sumNutrients(meals.map((m) => m.nutrients));
    const violations = describeViolations(nutrients, context.targets.perDay);
    if (violations.length > 0) {
      problems.push({
        severity: 'error',
        rule: 'day_limit',
        message: `Day total outside limits: ${violations.join(', ')}`,
        date: day.date,
      });
    }
    return { date: day.date, nutrients, meals };
  });

  for (const { dish, days: used } of usage.values()) {
    const cooks =
      dish.cookMinutes === 0
        ? Math.ceil(used.length / 2) // no cooking (fruit, nuts): two servings count as one
        : countCooks(used, dish.batchCookable ? Math.min(dish.keepsDays ?? 1, 2) : null);
    if (cooks > maxCooks) {
      problems.push({
        severity: 'error',
        rule: 'repeat_limit',
        message: `${dish.name} is cooked ${cooks} times; the limit is ${maxCooks}`,
        dishId: dish.id,
      });
    }
  }

  const budget = context.weeklyBudgetMinor ?? null;
  if (budget !== null) {
    if (weekCost === null) {
      problems.push({
        severity: 'warning',
        rule: 'budget_unchecked',
        message: 'Some dishes have no price, so the budget could not be checked',
      });
    } else if (weekCost > budget) {
      problems.push({
        severity: 'error',
        rule: 'budget',
        message: `Estimated cost ${Math.round(weekCost)} is over the budget of ${budget}`,
      });
    }
  }

  if (missingNutrients.size > 0) {
    problems.push({
      severity: 'warning',
      rule: 'missing_nutrients',
      message: `No nutrient data for: ${[...missingNutrients].sort().join(', ')}. Totals are understated.`,
    });
  }

  const status = problems.some((p) => p.severity === 'error')
    ? 'failed'
    : problems.length > 0
      ? 'warnings'
      : 'ok';
  return {
    status,
    problems,
    recomputed: {
      days,
      weekNutrients: sumNutrients(days.map((d) => d.nutrients)),
      weekCostMinor: weekCost,
    },
  };
}

/** Cooking sessions; a batch-cooked dish eaten within its window counts once. */
function countCooks(days: number[], batchDays: number | null): number {
  if (batchDays === null) return days.length;
  let cooks = 0;
  let start = -Infinity;
  let uses = 0;
  for (const day of [...days].sort((a, b) => a - b)) {
    if (day - start >= batchDays || uses >= batchDays) {
      cooks++;
      start = day;
      uses = 1;
    } else {
      uses++;
    }
  }
  return cooks;
}
