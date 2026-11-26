import { dishNutrition, type NutrientsPer100g } from '@dyjext/nutrition';
import { type DishType, type MealType, type PlannerDish } from './types.js';

/**
 * A dish as stored in the catalogue: raw ingredients with per-100 g nutrients.
 * The validator works from this, never from nutrients the engine computed.
 */
export interface CatalogueDish {
  id: string;
  familyId: string;
  version: number;
  name: string;
  mealTypes: MealType[];
  dishType: DishType;
  pairsWith: DishType[];
  servingUnit: string;
  texture: 'regular' | 'soft';
  batchCookable: boolean;
  keepsDays: number | null;
  prepMinutes: number;
  cookMinutes: number;
  tags: string[];
  verificationStatus: 'draft' | 'dietitian_verified' | 'retired';
  costPerServingMinor: number | null;
  ingredients: {
    ingredientId: string;
    name: string;
    gramsPerServing: number;
    isOptional: boolean;
    per100g: NutrientsPer100g | null;
  }[];
}

/** Convert a catalogue dish to the engine's input, computing nutrients per serving. */
export function toPlannerDish(dish: CatalogueDish): PlannerDish {
  const { perServing } = dishNutrition(dish.ingredients);
  return {
    id: dish.id,
    familyId: dish.familyId,
    version: dish.version,
    name: dish.name,
    mealTypes: dish.mealTypes,
    dishType: dish.dishType,
    pairsWith: dish.pairsWith,
    servingUnit: dish.servingUnit,
    texture: dish.texture,
    batchCookable: dish.batchCookable,
    keepsDays: dish.keepsDays,
    prepMinutes: dish.prepMinutes,
    cookMinutes: dish.cookMinutes,
    tags: dish.tags,
    ingredientIds: dish.ingredients.filter((i) => !i.isOptional).map((i) => i.ingredientId),
    perServing,
    costPerServingMinor: dish.costPerServingMinor,
  };
}
