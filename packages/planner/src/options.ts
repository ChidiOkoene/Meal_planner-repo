import { describePortion, type Nutrients, scaleNutrients, sumNutrients } from '@dyjext/nutrition';
import { bandViolation } from './bands.js';
import {
  type MealType,
  type NutrientBands,
  type PlannedItem,
  type PlannerDish,
  type PlannerExclusions,
} from './types.js';

/** Portion multipliers tried for each dish, as quarter steps of a standard serving. */
export const PORTIONS = [0.5, 0.75, 1, 1.25, 1.5] as const;

/** One way to fill a meal: a single dish, or a soup with a swallow, each with its portion. */
export interface MealOption {
  key: string;
  mealType: MealType;
  items: { dish: PlannerDish; portion: number }[];
  nutrients: Nutrients;
  /** Cost for one eater, or null if any dish is unpriced. */
  costMinor: number | null;
  familyIds: string[];
  ingredientIds: string[];
  /** Sum of |portion − 1| across items: how far from standard servings. */
  portionDeviation: number;
}

/** Dishes allowed at all: not excluded, right texture. */
export function allowedDishes(
  dishes: PlannerDish[],
  exclusions: PlannerExclusions = {},
): PlannerDish[] {
  const badIngredients = new Set(exclusions.ingredientIds ?? []);
  const badFamilies = new Set(exclusions.familyIds ?? []);
  return dishes
    .filter((d) => !badFamilies.has(d.familyId))
    .filter((d) => !d.ingredientIds.some((id) => badIngredients.has(id)))
    .filter((d) => !exclusions.softTextureOnly || d.texture === 'soft')
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Every meal option for a meal type that meets its per-meal limits: each dish (or soup +
 * swallow pair) at every portion that fits. The scorer prefers standard portions, but larger
 * or smaller ones stay available to meet daily minimums and maximums.
 * Options are sorted by key, so the result is deterministic.
 */
export function buildMealOptions(
  mealType: MealType,
  dishes: PlannerDish[],
  bands: NutrientBands | undefined,
): MealOption[] {
  const forMeal = dishes.filter((d) => d.mealTypes.includes(mealType));
  const options: MealOption[] = [];

  // Dishes eaten on their own.
  for (const dish of forMeal.filter((d) => d.dishType !== 'soup' && d.dishType !== 'swallow')) {
    for (const [portion] of fittingPortions([dish], bands)) {
      options.push(makeOption(mealType, [{ dish, portion: portion! }]));
    }
  }

  // A soup with a swallow: portions chosen together, which is how carbs are controlled.
  const soups = forMeal.filter((d) => d.dishType === 'soup' && d.pairsWith.includes('swallow'));
  const swallows = forMeal.filter((d) => d.dishType === 'swallow');
  for (const soup of soups) {
    for (const swallow of swallows) {
      for (const [soupPortion, swallowPortion] of fittingPortions([soup, swallow], bands)) {
        options.push(
          makeOption(mealType, [
            { dish: soup, portion: soupPortion! },
            { dish: swallow, portion: swallowPortion! },
          ]),
        );
      }
    }
  }

  return options.sort((a, b) => a.key.localeCompare(b.key));
}

/** Every combination of portions (one per dish) that keeps the meal within its bands. */
function fittingPortions(dishes: PlannerDish[], bands: NutrientBands | undefined): number[][] {
  const fitting: number[][] = [];
  for (const portions of combinations(dishes.length)) {
    const nutrients = sumNutrients(
      dishes.map((d, i) => scaleNutrients(d.perServing, portions[i]!)),
    );
    if (bandViolation(nutrients, bands) === 0) fitting.push(portions);
  }
  return fitting;
}

function* combinations(length: number): Generator<number[]> {
  if (length === 0) {
    yield [];
    return;
  }
  for (const first of PORTIONS) {
    for (const rest of combinations(length - 1)) yield [first, ...rest];
  }
}

function makeOption(
  mealType: MealType,
  items: { dish: PlannerDish; portion: number }[],
): MealOption {
  const costs = items.map((i) =>
    i.dish.costPerServingMinor === null ? null : i.dish.costPerServingMinor * i.portion,
  );
  return {
    key: items.map((i) => `${i.dish.id}@${i.portion}`).join('+'),
    mealType,
    items,
    nutrients: sumNutrients(items.map((i) => scaleNutrients(i.dish.perServing, i.portion))),
    costMinor: costs.some((c) => c === null) ? null : costs.reduce<number>((s, c) => s + c!, 0),
    familyIds: items.map((i) => i.dish.familyId),
    ingredientIds: [...new Set(items.flatMap((i) => i.dish.ingredientIds))],
    portionDeviation: items.reduce((sum, i) => sum + Math.abs(i.portion - 1), 0),
  };
}

export function toPlannedItems(option: MealOption): PlannedItem[] {
  return option.items.map(({ dish, portion }) => ({
    dishId: dish.id,
    familyId: dish.familyId,
    version: dish.version,
    name: dish.name,
    dishType: dish.dishType,
    portion,
    portionText: describePortion(portion, dish.servingUnit, dish.name),
    nutrients: scaleNutrients(dish.perServing, portion),
    costMinor: dish.costPerServingMinor === null ? null : dish.costPerServingMinor * portion,
  }));
}
