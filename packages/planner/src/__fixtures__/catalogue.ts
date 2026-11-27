// Test catalogue: a subset of the development sample catalogue (packages/db seed data).
// Approximate nutrients; for tests only.
import { dishNutrition, type Nutrients } from '@dyjext/nutrition';
import { type PlannerDish, type PlannerTargets } from '../types.js';

type Per100 = [
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  fibre: number,
  sodium: number,
];

// prettier-ignore
const INGREDIENTS: Record<string, Per100> = {
  rice: [360, 6.7, 80, 0.6, 1.3, 5], ofada: [362, 7.5, 76, 2.7, 3.5, 5], yam: [118, 1.5, 28, 0.2, 4.1, 9],
  garri: [360, 1.2, 87, 0.5, 2, 10], elubo: [340, 3.5, 82, 0.4, 4, 10], plantainFlour: [340, 3, 80, 0.8, 6, 10],
  oats: [389, 16.9, 66, 6.9, 10.6, 2], ogi: [355, 8, 76, 3, 5, 5], bread: [247, 13, 41, 3.4, 7, 450],
  plantain: [122, 1.3, 32, 0.4, 2.3, 4], sweetPotato: [86, 1.6, 20, 0.1, 3, 55], beans: [336, 23.5, 60, 1.3, 10.6, 16],
  egusi: [557, 28, 15, 47, 3, 25], groundnuts: [585, 24, 21, 50, 8, 18], chicken: [120, 22.5, 0, 2.6, 0, 45],
  beef: [150, 21, 0, 7, 0, 60], goat: [109, 20.6, 0, 2.3, 0, 82], tilapia: [96, 20, 0, 1.7, 0, 52],
  mackerel: [205, 18.6, 0, 13.9, 0, 90], driedFish: [290, 62, 0, 2.5, 0, 400], crayfish: [320, 60, 3, 5, 0, 2400],
  eggs: [143, 12.6, 0.7, 9.5, 0, 142], ugu: [47, 4, 6, 1, 3.5, 20], amaranth: [23, 2.5, 4, 0.3, 2.2, 20],
  okra: [33, 1.9, 7.5, 0.2, 3.2, 7], tomatoes: [18, 0.9, 3.9, 0.2, 1.2, 5], onions: [40, 1.1, 9.3, 0.1, 1.7, 4],
  pepper: [31, 1, 6, 0.3, 2.1, 4], cabbage: [25, 1.3, 5.8, 0.1, 2.5, 18], carrots: [41, 0.9, 9.6, 0.2, 2.8, 69],
  cucumber: [15, 0.7, 3.6, 0.1, 0.5, 2], avocado: [160, 2, 8.5, 14.7, 6.7, 7], orange: [47, 0.9, 11.8, 0.1, 2.4, 0],
  banana: [89, 1.1, 22.8, 0.3, 2.6, 1], pawpaw: [43, 0.5, 10.8, 0.3, 1.7, 8], gardenEgg: [25, 1, 6, 0.2, 3, 2],
  palmOil: [884, 0, 0, 100, 0, 0], oil: [884, 0, 0, 100, 0, 0], milk: [42, 3.4, 5, 1, 0, 44],
  salt: [0, 0, 0, 0, 0, 38758], cube: [250, 10, 30, 10, 0, 22000],
};

interface FixtureDish {
  name: string;
  mealTypes: PlannerDish['mealTypes'];
  dishType: PlannerDish['dishType'];
  servingUnit: string;
  soft?: boolean;
  batch?: number;
  cook?: number;
  tags?: string[];
  ingredients: [string, number][];
}

// prettier-ignore
const DISHES: FixtureDish[] = [
  { name: 'Oats with milk and banana', mealTypes: ['breakfast'], dishType: 'main', servingUnit: 'bowl', soft: true, cook: 8, tags: ['high-fibre'], ingredients: [['oats', 40], ['milk', 200], ['banana', 60]] },
  { name: 'Moi moi with pap', mealTypes: ['breakfast'], dishType: 'main', servingUnit: 'plate', soft: true, batch: 3, cook: 45, tags: ['high-fibre'], ingredients: [['beans', 60], ['oil', 8], ['eggs', 25], ['pepper', 15], ['onions', 10], ['crayfish', 3], ['salt', 0.5], ['ogi', 30], ['milk', 50]] },
  { name: 'Boiled yam with egg sauce', mealTypes: ['breakfast'], dishType: 'main', servingUnit: 'plate', cook: 20, ingredients: [['yam', 150], ['eggs', 50], ['tomatoes', 60], ['onions', 20], ['oil', 8], ['salt', 0.5]] },
  { name: 'Whole-wheat bread with egg and tomato', mealTypes: ['breakfast'], dishType: 'main', servingUnit: 'plate', cook: 10, ingredients: [['bread', 70], ['eggs', 50], ['tomatoes', 50], ['cucumber', 40]] },
  { name: 'Sweet potato with egg sauce', mealTypes: ['breakfast'], dishType: 'main', servingUnit: 'plate', cook: 20, ingredients: [['sweetPotato', 150], ['eggs', 50], ['tomatoes', 50], ['onions', 15], ['oil', 8], ['salt', 0.5]] },
  { name: 'Boiled plantain with egg sauce', mealTypes: ['breakfast', 'lunch'], dishType: 'main', servingUnit: 'plate', cook: 20, tags: ['low-gi'], ingredients: [['plantain', 150], ['eggs', 50], ['tomatoes', 50], ['onions', 15], ['oil', 8], ['salt', 0.5]] },
  { name: 'Jollof rice with chicken', mealTypes: ['lunch', 'dinner'], dishType: 'main', servingUnit: 'plate', batch: 3, cook: 45, ingredients: [['rice', 70], ['chicken', 90], ['tomatoes', 60], ['pepper', 30], ['onions', 25], ['oil', 12], ['cube', 2], ['salt', 0.5]] },
  { name: 'Ofada rice with tomato stew and fish', mealTypes: ['lunch', 'dinner'], dishType: 'main', servingUnit: 'plate', batch: 3, cook: 50, tags: ['high-fibre', 'low-gi'], ingredients: [['ofada', 70], ['tilapia', 100], ['tomatoes', 80], ['pepper', 30], ['onions', 20], ['oil', 10], ['cube', 1.5]] },
  { name: 'Beans porridge with plantain', mealTypes: ['lunch', 'dinner'], dishType: 'main', servingUnit: 'plate', soft: true, batch: 3, cook: 60, tags: ['high-fibre', 'low-gi'], ingredients: [['beans', 70], ['plantain', 80], ['palmOil', 8], ['onions', 20], ['pepper', 5], ['crayfish', 3], ['salt', 0.5]] },
  { name: 'Yam porridge with greens', mealTypes: ['lunch', 'dinner'], dishType: 'main', servingUnit: 'plate', soft: true, cook: 30, ingredients: [['yam', 180], ['ugu', 40], ['palmOil', 8], ['driedFish', 15], ['crayfish', 3], ['onions', 20], ['pepper', 5], ['salt', 0.5]] },
  { name: 'Vegetable salad with grilled chicken', mealTypes: ['lunch', 'dinner'], dishType: 'main', servingUnit: 'bowl', cook: 15, tags: ['high-fibre', 'low-gi'], ingredients: [['chicken', 100], ['cabbage', 60], ['carrots', 40], ['cucumber', 50], ['tomatoes', 50], ['avocado', 40]] },
  { name: 'Grilled fish with boiled plantain', mealTypes: ['lunch', 'dinner'], dishType: 'main', servingUnit: 'plate', cook: 30, tags: ['low-gi'], ingredients: [['mackerel', 120], ['plantain', 150], ['tomatoes', 50], ['onions', 20], ['pepper', 5], ['oil', 5]] },
  { name: 'Goat meat pepper soup', mealTypes: ['dinner'], dishType: 'main', servingUnit: 'bowl', batch: 3, cook: 60, ingredients: [['goat', 120], ['onions', 20], ['pepper', 5], ['cube', 1], ['salt', 0.8]] },
  { name: 'Efo riro', mealTypes: ['lunch', 'dinner'], dishType: 'soup', servingUnit: 'ladle', batch: 4, cook: 30, tags: ['high-fibre'], ingredients: [['amaranth', 150], ['palmOil', 12], ['beef', 60], ['driedFish', 10], ['pepper', 30], ['onions', 20], ['crayfish', 4], ['cube', 1], ['salt', 0.5]] },
  { name: 'Egusi soup', mealTypes: ['lunch', 'dinner'], dishType: 'soup', servingUnit: 'ladle', batch: 4, cook: 40, ingredients: [['egusi', 35], ['ugu', 60], ['palmOil', 10], ['beef', 60], ['driedFish', 10], ['crayfish', 4], ['onions', 15], ['pepper', 5], ['cube', 1], ['salt', 0.5]] },
  { name: 'Okra soup', mealTypes: ['lunch', 'dinner'], dishType: 'soup', servingUnit: 'ladle', soft: true, batch: 3, cook: 25, tags: ['high-fibre'], ingredients: [['okra', 120], ['ugu', 30], ['palmOil', 8], ['tilapia', 80], ['crayfish', 4], ['pepper', 5], ['onions', 10], ['cube', 1], ['salt', 0.5]] },
  { name: 'Eba', mealTypes: ['lunch', 'dinner'], dishType: 'swallow', servingUnit: 'wrap', soft: true, cook: 3, ingredients: [['garri', 60]] },
  { name: 'Amala', mealTypes: ['lunch', 'dinner'], dishType: 'swallow', servingUnit: 'wrap', soft: true, cook: 8, ingredients: [['elubo', 60]] },
  { name: 'Pounded yam', mealTypes: ['lunch', 'dinner'], dishType: 'swallow', servingUnit: 'wrap', soft: true, cook: 25, ingredients: [['yam', 180]] },
  { name: 'Unripe plantain amala', mealTypes: ['lunch', 'dinner'], dishType: 'swallow', servingUnit: 'wrap', soft: true, cook: 8, tags: ['low-gi', 'high-fibre'], ingredients: [['plantainFlour', 60]] },
  { name: 'Roasted groundnuts', mealTypes: ['snack'], dishType: 'snack', servingUnit: 'handful', ingredients: [['groundnuts', 25]] },
  { name: 'Orange', mealTypes: ['snack'], dishType: 'snack', servingUnit: 'piece', ingredients: [['orange', 150]] },
  { name: 'Garden egg with groundnuts', mealTypes: ['snack'], dishType: 'snack', servingUnit: 'plate', tags: ['high-fibre'], ingredients: [['gardenEgg', 100], ['groundnuts', 15]] },
  { name: 'Pawpaw slices', mealTypes: ['snack'], dishType: 'snack', servingUnit: 'bowl', soft: true, ingredients: [['pawpaw', 150]] },
  { name: 'Banana', mealTypes: ['snack'], dishType: 'snack', servingUnit: 'piece', soft: true, ingredients: [['banana', 100]] },
];

function per100g([energyKcal, proteinG, carbsG, fatG, fibreG, sodiumMg]: Per100): Nutrients {
  return { energyKcal, proteinG, carbsG, fatG, fibreG, sodiumMg, potassiumMg: null };
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function fixtureDishes(
  options: { costPerServingMinor?: number | null } = {},
): PlannerDish[] {
  return DISHES.map((d) => {
    const id = `dish-${slug(d.name)}`;
    const nutrition = dishNutrition(
      d.ingredients.map(([name, grams]) => {
        const values = INGREDIENTS[name];
        if (!values) throw new Error(`Unknown fixture ingredient ${name}`);
        return { name, gramsPerServing: grams, per100g: per100g(values) };
      }),
    );
    return {
      id,
      familyId: id,
      version: 1,
      name: d.name,
      mealTypes: d.mealTypes,
      dishType: d.dishType,
      pairsWith: d.dishType === 'soup' ? ['swallow'] : d.dishType === 'swallow' ? ['soup'] : [],
      servingUnit: d.servingUnit,
      texture: d.soft ? 'soft' : 'regular',
      batchCookable: d.batch !== undefined,
      keepsDays: d.batch ?? null,
      prepMinutes: 10,
      cookMinutes: d.cook ?? 0,
      tags: d.tags ?? [],
      ingredientIds: d.ingredients.map(([name]) => name),
      perServing: nutrition.perServing,
      costPerServingMinor: options.costPerServingMinor ?? null,
    };
  });
}

/**
 * Example limits for an adult with type 2 diabetes and high blood pressure.
 * Illustrative only: real limits are set and signed by a dietitian for each person.
 */
export const DIABETES_HYPERTENSION_TARGETS: PlannerTargets = {
  perMeal: {
    breakfast: { carbsG: { min: 20, max: 55 }, energyKcal: { max: 550 } },
    lunch: { carbsG: { min: 30, max: 65 }, sodiumMg: { max: 900 }, energyKcal: { max: 750 } },
    dinner: { carbsG: { min: 30, max: 65 }, sodiumMg: { max: 900 }, energyKcal: { max: 750 } },
    snack: { carbsG: { max: 25 }, energyKcal: { max: 250 } },
  },
  perDay: {
    carbsG: { min: 130, max: 210 },
    sodiumMg: { max: 2300 },
    energyKcal: { min: 1200, max: 2100 },
    proteinG: { min: 50 },
    fibreG: { min: 20 },
  },
};

export const WEEK = [
  '2026-12-07',
  '2026-12-08',
  '2026-12-09',
  '2026-12-10',
  '2026-12-11',
  '2026-12-12',
  '2026-12-13',
];
export const MEALS = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
