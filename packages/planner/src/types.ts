import { type Nutrients } from '@dyjext/nutrition';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type DishType = 'main' | 'soup' | 'swallow' | 'side' | 'snack' | 'drink';

/** Nutrients the dietitian can set limits on. Potassium has no limits yet (data is incomplete). */
export type LimitedNutrient = Exclude<keyof Nutrients, 'potassiumMg'>;

/** An allowed range. Either end may be open. */
export interface Band {
  min?: number;
  max?: number;
}

export type NutrientBands = Partial<Record<LimitedNutrient, Band>>;

/** Limits signed by a dietitian. The planner treats every one as a hard rule. */
export interface PlannerTargets {
  /** Limits for each meal of a given type, e.g. lunch carbs 30–60 g. */
  perMeal: Partial<Record<MealType, NutrientBands>>;
  /** Limits for each day's total. */
  perDay: NutrientBands;
}

/** A dish version the planner may use, with nutrients already computed per serving. */
export interface PlannerDish {
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
  /** Days a cooked batch keeps. Null means it is cooked fresh each time. */
  keepsDays: number | null;
  prepMinutes: number;
  cookMinutes: number;
  tags: string[];
  ingredientIds: string[];
  perServing: Nutrients;
  /** Estimated cost of one serving in the market currency's minor units. Null until priced. */
  costPerServingMinor: number | null;
}

export interface PlannerPreferences {
  /** Dish families the recipient enjoys. */
  favouriteFamilyIds?: string[];
  /** Dish families used in the last four weeks (repeat entries for repeat use). */
  recentFamilyIds?: string[];
  /** Who cooks; long cooking is discouraged when the recipient cooks for themself. */
  cooking?: 'self' | 'helper';
}

export interface PlannerExclusions {
  /** Allergies, intolerances, religious rules and dislikes, as ingredient ids. */
  ingredientIds?: string[];
  /** Disliked dishes. */
  familyIds?: string[];
  /** Only soft-textured dishes (chewing difficulty). */
  softTextureOnly?: boolean;
}

export interface PlannerInput {
  /** ISO dates, one per day to plan (normally 7). */
  dates: string[];
  /** Meals each day, in order, e.g. ['breakfast', 'lunch', 'snack', 'dinner']. */
  mealsPerDay: MealType[];
  dishes: PlannerDish[];
  targets: PlannerTargets;
  exclusions?: PlannerExclusions;
  preferences?: PlannerPreferences;
  /** Weekly food budget in minor units of the market currency. Null = no budget check. */
  weeklyBudgetMinor?: number | null;
  /** People eating the same food (scales cost, not nutrients). Default 1. */
  eaters?: number;
  /** Times the same dish may be cooked in a week. Default 2. A batch eaten over several days counts once. */
  maxCooksPerDishPerWeek?: number;
}

export interface PlannerOptions {
  /** Same input + same seed → same plan. */
  seed: string;
  /** Improvement iterations. Default 4000. */
  iterations?: number;
  weights?: Partial<ScoreWeights>;
}

/** Soft preferences. Hard rules (limits, exclusions, repeats, budget) are never traded for these. */
export interface ScoreWeights {
  favourite: number;
  recentRepeat: number;
  sameDishNextDay: number;
  ingredientReuse: number;
  portionDeviation: number;
  longCookingForSelfCook: number;
  batchReuse: number;
  /** Penalty for each use of a dish beyond the second in a week, even as leftovers. */
  extraUse: number;
  tag: Record<string, number>;
}

export interface PlannedItem {
  dishId: string;
  familyId: string;
  version: number;
  name: string;
  dishType: DishType;
  /** Multiple of one standard serving (0.5–1.5 in quarter steps). */
  portion: number;
  /** e.g. "1½ wraps of Eba". */
  portionText: string;
  nutrients: Nutrients;
  costMinor: number | null;
}

export interface PlannedMeal {
  mealType: MealType;
  items: PlannedItem[];
  nutrients: Nutrients;
  costMinor: number | null;
}

export interface PlannedDay {
  date: string;
  meals: PlannedMeal[];
  nutrients: Nutrients;
}

export interface UnmetRule {
  rule: 'meal_limit' | 'day_limit' | 'repeat_limit' | 'budget' | 'no_options';
  message: string;
  date?: string;
  mealType?: MealType;
}

export interface PlannerResult {
  /** `ok`: every hard rule holds. `infeasible`: the best plan found still breaks a rule. */
  status: 'ok' | 'infeasible';
  engineVersion: string;
  seed: string;
  days: PlannedDay[];
  weekNutrients: PlannedDay['nutrients'];
  /** Estimated weekly cost, or null when any dish is unpriced. */
  weekCostMinor: number | null;
  score: number;
  unmet: UnmetRule[];
  warnings: string[];
}
