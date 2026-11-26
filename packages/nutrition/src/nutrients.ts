/**
 * Nutrient amounts. Units: kcal for energy, milligrams for sodium and potassium, grams otherwise.
 * `potassiumMg` is null when any contributing ingredient has no potassium value, so a partial
 * total is never mistaken for a complete one.
 */
export interface Nutrients {
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
  sodiumMg: number;
  potassiumMg: number | null;
}

/** Nutrients per 100 g of an ingredient, as stored in `nutrient_profiles`. */
export type NutrientsPer100g = Nutrients;

export const NUTRIENT_KEYS = [
  'energyKcal',
  'proteinG',
  'carbsG',
  'fatG',
  'fibreG',
  'sodiumMg',
  'potassiumMg',
] as const satisfies readonly (keyof Nutrients)[];

export const ZERO_NUTRIENTS: Readonly<Nutrients> = Object.freeze({
  energyKcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fibreG: 0,
  sodiumMg: 0,
  potassiumMg: 0,
});

/** Nutrients in `grams` of an ingredient. */
export function nutrientsForGrams(per100g: NutrientsPer100g, grams: number): Nutrients {
  if (!Number.isFinite(grams) || grams < 0) {
    throw new RangeError(`grams must be a non-negative number, got ${grams}`);
  }
  return scaleNutrients(per100g, grams / 100);
}

/** Multiply every nutrient by `factor` (e.g. a portion multiplier or number of servings). */
export function scaleNutrients(nutrients: Nutrients, factor: number): Nutrients {
  if (!Number.isFinite(factor) || factor < 0) {
    throw new RangeError(`factor must be a non-negative number, got ${factor}`);
  }
  return {
    energyKcal: nutrients.energyKcal * factor,
    proteinG: nutrients.proteinG * factor,
    carbsG: nutrients.carbsG * factor,
    fatG: nutrients.fatG * factor,
    fibreG: nutrients.fibreG * factor,
    sodiumMg: nutrients.sodiumMg * factor,
    potassiumMg: nutrients.potassiumMg === null ? null : nutrients.potassiumMg * factor,
  };
}

/** Add nutrient amounts. An empty list sums to zero. */
export function sumNutrients(items: readonly Nutrients[]): Nutrients {
  return items.reduce<Nutrients>(
    (total, item) => ({
      energyKcal: total.energyKcal + item.energyKcal,
      proteinG: total.proteinG + item.proteinG,
      carbsG: total.carbsG + item.carbsG,
      fatG: total.fatG + item.fatG,
      fibreG: total.fibreG + item.fibreG,
      sodiumMg: total.sodiumMg + item.sodiumMg,
      potassiumMg:
        total.potassiumMg === null || item.potassiumMg === null
          ? null
          : total.potassiumMg + item.potassiumMg,
    }),
    { ...ZERO_NUTRIENTS },
  );
}

/** Round for display: energy and minerals to whole numbers, grams to one decimal place. */
export function roundNutrients(nutrients: Nutrients): Nutrients {
  const one = (value: number) => Math.round(value * 10) / 10;
  return {
    energyKcal: Math.round(nutrients.energyKcal),
    proteinG: one(nutrients.proteinG),
    carbsG: one(nutrients.carbsG),
    fatG: one(nutrients.fatG),
    fibreG: one(nutrients.fibreG),
    sodiumMg: Math.round(nutrients.sodiumMg),
    potassiumMg: nutrients.potassiumMg === null ? null : Math.round(nutrients.potassiumMg),
  };
}

export interface DishIngredientInput {
  name: string;
  gramsPerServing: number;
  isOptional?: boolean;
  /** Null when the ingredient has no nutrient profile yet. */
  per100g: NutrientsPer100g | null;
}

export interface DishNutrition {
  perServing: Nutrients;
  /** Ingredients with no nutrient profile, so the total is incomplete. */
  missingProfiles: string[];
}

/**
 * Nutrients in one serving of a dish, summed from its ingredients.
 * Optional ingredients are left out unless `includeOptional` is set.
 */
export function dishNutrition(
  ingredients: readonly DishIngredientInput[],
  options: { includeOptional?: boolean } = {},
): DishNutrition {
  const included = ingredients.filter((i) => options.includeOptional || !i.isOptional);
  const missingProfiles = included.filter((i) => i.per100g === null).map((i) => i.name);
  const perServing = sumNutrients(
    included
      .filter((i): i is DishIngredientInput & { per100g: NutrientsPer100g } => i.per100g !== null)
      .map((i) => nutrientsForGrams(i.per100g, i.gramsPerServing)),
  );
  return { perServing, missingProfiles };
}

const CSV_ROWS: { key: keyof Nutrients; label: string; unit: string }[] = [
  { key: 'energyKcal', label: 'Energy', unit: 'kcal' },
  { key: 'proteinG', label: 'Protein', unit: 'g' },
  { key: 'carbsG', label: 'Carbohydrates', unit: 'g' },
  { key: 'fatG', label: 'Fat', unit: 'g' },
  { key: 'fibreG', label: 'Fibre', unit: 'g' },
  { key: 'sodiumMg', label: 'Sodium', unit: 'mg' },
  { key: 'potassiumMg', label: 'Potassium', unit: 'mg' },
];

/**
 * CSV export (`Nutrient,Amount,Unit`), rounded for display. A real zero is written as 0;
 * only an unknown value (null) is left out.
 */
export function nutrientsToCsv(nutrients: Nutrients): string {
  const rounded = roundNutrients(nutrients);
  const lines = CSV_ROWS.flatMap(({ key, label, unit }) => {
    const value = rounded[key];
    return value === null ? [] : [`${label},${value},${unit}`];
  });
  return ['Nutrient,Amount,Unit', ...lines].join('\n');
}
