// SAMPLE CATALOGUE FOR DEVELOPMENT ONLY.
//
// Nutrient values are rounded approximations of typical published values, recorded with
// source "estimate" and low/medium confidence. They exist so the planner can be built and
// demonstrated. They are NOT dietitian-verified and must not be used for real recipients.
// Issue #12 replaces this file with an importer for sourced data (e.g. FAO/INFOODS WAFCT 2019).
//
// Ingredient grams are per serving, as purchased (raw / dry).

import type {
  Cuisine,
  DishTexture,
  DishType,
  IngredientCategory,
  LocalUnitKind,
  MealType,
  NutrientConfidence,
} from '../../src/generated/prisma/client.js';

export interface SampleIngredient {
  name: string;
  aliases?: string[];
  category: IngredientCategory;
  pantry?: boolean;
  perishabilityDays?: number;
  /** Per 100 g: kcal, protein, carbs, fat, fibre (g), sodium (mg). Optional potassium and GI. */
  per100g: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fibre: number;
    sodium: number;
    potassium?: number;
    gi?: number;
  };
  confidence?: NutrientConfidence;
}

// prettier-ignore
export const ingredients: SampleIngredient[] = [
  // Staples
  { name: 'White rice (raw)', aliases: ['rice'], category: 'staple', perishabilityDays: 365, per100g: { kcal: 360, protein: 6.7, carbs: 80, fat: 0.6, fibre: 1.3, sodium: 5, potassium: 86, gi: 73 } },
  { name: 'Ofada rice (raw)', aliases: ['ofada', 'local brown rice'], category: 'staple', perishabilityDays: 180, per100g: { kcal: 362, protein: 7.5, carbs: 76, fat: 2.7, fibre: 3.5, sodium: 5, potassium: 220, gi: 55 } },
  { name: 'Yam (raw)', aliases: ['isu', 'ji', 'doya'], category: 'staple', perishabilityDays: 30, per100g: { kcal: 118, protein: 1.5, carbs: 28, fat: 0.2, fibre: 4.1, sodium: 9, potassium: 816, gi: 54 } },
  { name: 'Garri (cassava flakes)', aliases: ['gari'], category: 'staple', perishabilityDays: 180, per100g: { kcal: 360, protein: 1.2, carbs: 87, fat: 0.5, fibre: 2.0, sodium: 10, potassium: 300, gi: 70 } },
  { name: 'Yam flour (elubo)', aliases: ['elubo', 'amala flour'], category: 'staple', perishabilityDays: 180, per100g: { kcal: 340, protein: 3.5, carbs: 82, fat: 0.4, fibre: 4.0, sodium: 10, potassium: 900, gi: 60 }, confidence: 'low' },
  { name: 'Unripe plantain flour', aliases: ['elubo ogede'], category: 'staple', perishabilityDays: 180, per100g: { kcal: 340, protein: 3.0, carbs: 80, fat: 0.8, fibre: 6.0, sodium: 10, potassium: 1100, gi: 40 }, confidence: 'low' },
  { name: 'Semolina', aliases: ['semovita', 'semo'], category: 'staple', perishabilityDays: 180, per100g: { kcal: 360, protein: 12.7, carbs: 73, fat: 1.1, fibre: 3.9, sodium: 1, potassium: 186, gi: 65 } },
  { name: 'Rolled oats', aliases: ['oats', 'quaker'], category: 'staple', perishabilityDays: 270, per100g: { kcal: 389, protein: 16.9, carbs: 66, fat: 6.9, fibre: 10.6, sodium: 2, potassium: 429, gi: 55 } },
  { name: 'Maize pap powder (ogi)', aliases: ['ogi', 'akamu', 'koko'], category: 'staple', perishabilityDays: 90, per100g: { kcal: 355, protein: 8.0, carbs: 76, fat: 3.0, fibre: 5.0, sodium: 5, potassium: 250, gi: 66 }, confidence: 'low' },
  { name: 'Whole-wheat bread', aliases: ['wheat bread'], category: 'staple', perishabilityDays: 5, per100g: { kcal: 247, protein: 13, carbs: 41, fat: 3.4, fibre: 7.0, sodium: 450, potassium: 250, gi: 69 } },
  { name: 'Spaghetti (dry)', aliases: ['pasta'], category: 'staple', perishabilityDays: 365, per100g: { kcal: 371, protein: 13, carbs: 75, fat: 1.5, fibre: 3.2, sodium: 6, potassium: 223, gi: 49 } },
  { name: 'Unripe plantain', aliases: ['ogede', 'green plantain'], category: 'staple', perishabilityDays: 7, per100g: { kcal: 122, protein: 1.3, carbs: 32, fat: 0.4, fibre: 2.3, sodium: 4, potassium: 499, gi: 40 } },
  { name: 'Sweet potato', aliases: ['anamo'], category: 'staple', perishabilityDays: 21, per100g: { kcal: 86, protein: 1.6, carbs: 20, fat: 0.1, fibre: 3.0, sodium: 55, potassium: 337, gi: 63 } },

  // Legumes, nuts and seeds
  { name: 'Black-eyed beans (dry)', aliases: ['ewa', 'beans', 'oloyin'], category: 'legume', perishabilityDays: 365, per100g: { kcal: 336, protein: 23.5, carbs: 60, fat: 1.3, fibre: 10.6, sodium: 16, potassium: 1112, gi: 42 } },
  { name: 'Egusi (ground melon seed)', aliases: ['egusi', 'agushi'], category: 'nut_seed', perishabilityDays: 90, per100g: { kcal: 557, protein: 28, carbs: 15, fat: 47, fibre: 3.0, sodium: 25, potassium: 650 }, confidence: 'low' },
  { name: 'Groundnuts (roasted)', aliases: ['peanuts', 'epa', 'gyada'], category: 'nut_seed', perishabilityDays: 60, per100g: { kcal: 585, protein: 24, carbs: 21, fat: 50, fibre: 8.0, sodium: 18, potassium: 658, gi: 14 } },
  { name: 'Locust beans (iru)', aliases: ['iru', 'ogiri', 'dawadawa'], category: 'seasoning', pantry: true, perishabilityDays: 30, per100g: { kcal: 400, protein: 35, carbs: 15, fat: 25, fibre: 10, sodium: 900 }, confidence: 'low' },

  // Proteins
  { name: 'Chicken (skinless, raw)', aliases: ['chicken'], category: 'protein', perishabilityDays: 2, per100g: { kcal: 120, protein: 22.5, carbs: 0, fat: 2.6, fibre: 0, sodium: 45, potassium: 370 } },
  { name: 'Lean beef (raw)', aliases: ['beef', 'eran'], category: 'protein', perishabilityDays: 2, per100g: { kcal: 150, protein: 21, carbs: 0, fat: 7.0, fibre: 0, sodium: 60, potassium: 330 } },
  { name: 'Goat meat (raw)', aliases: ['goat', 'eran ewure'], category: 'protein', perishabilityDays: 2, per100g: { kcal: 109, protein: 20.6, carbs: 0, fat: 2.3, fibre: 0, sodium: 82, potassium: 385 } },
  { name: 'Tilapia (raw)', aliases: ['tilapia', 'eja'], category: 'protein', perishabilityDays: 2, per100g: { kcal: 96, protein: 20, carbs: 0, fat: 1.7, fibre: 0, sodium: 52, potassium: 302 } },
  { name: 'Mackerel (raw)', aliases: ['titus', 'mackerel'], category: 'protein', perishabilityDays: 2, per100g: { kcal: 205, protein: 18.6, carbs: 0, fat: 13.9, fibre: 0, sodium: 90, potassium: 314 } },
  { name: 'Dried fish', aliases: ['eja kika', 'panla', 'stockfish'], category: 'protein', perishabilityDays: 90, per100g: { kcal: 290, protein: 62, carbs: 0, fat: 2.5, fibre: 0, sodium: 400 }, confidence: 'low' },
  { name: 'Ground crayfish', aliases: ['crayfish', 'ede'], category: 'protein', pantry: true, perishabilityDays: 90, per100g: { kcal: 320, protein: 60, carbs: 3, fat: 5, fibre: 0, sodium: 2400 }, confidence: 'low' },
  { name: 'Eggs', aliases: ['egg', 'eyin', 'akwa'], category: 'protein', perishabilityDays: 21, per100g: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fibre: 0, sodium: 142, potassium: 138 } },

  // Vegetables
  { name: 'Fluted pumpkin leaves (ugu)', aliases: ['ugu'], category: 'vegetable', perishabilityDays: 3, per100g: { kcal: 47, protein: 4.0, carbs: 6.0, fat: 1.0, fibre: 3.5, sodium: 20, potassium: 400 }, confidence: 'low' },
  { name: 'Green amaranth (tete)', aliases: ['tete', 'efo tete', 'spinach'], category: 'vegetable', perishabilityDays: 3, per100g: { kcal: 23, protein: 2.5, carbs: 4.0, fat: 0.3, fibre: 2.2, sodium: 20, potassium: 611 } },
  { name: 'Okra', aliases: ['ila', 'okwuru'], category: 'vegetable', perishabilityDays: 4, per100g: { kcal: 33, protein: 1.9, carbs: 7.5, fat: 0.2, fibre: 3.2, sodium: 7, potassium: 299 } },
  { name: 'Tomatoes', aliases: ['tomato', 'tomati'], category: 'vegetable', perishabilityDays: 5, per100g: { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fibre: 1.2, sodium: 5, potassium: 237 } },
  { name: 'Onions', aliases: ['alubosa'], category: 'vegetable', perishabilityDays: 30, per100g: { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fibre: 1.7, sodium: 4, potassium: 146 } },
  { name: 'Red bell pepper (tatashe)', aliases: ['tatashe'], category: 'vegetable', perishabilityDays: 7, per100g: { kcal: 31, protein: 1.0, carbs: 6.0, fat: 0.3, fibre: 2.1, sodium: 4, potassium: 211 } },
  { name: 'Scotch bonnet pepper', aliases: ['ata rodo'], category: 'vegetable', perishabilityDays: 7, per100g: { kcal: 40, protein: 1.9, carbs: 9.0, fat: 0.4, fibre: 1.5, sodium: 7, potassium: 322 } },
  { name: 'Garden egg', aliases: ['igba', 'anara'], category: 'vegetable', perishabilityDays: 7, per100g: { kcal: 25, protein: 1.0, carbs: 6.0, fat: 0.2, fibre: 3.0, sodium: 2, potassium: 229 } },
  { name: 'Cabbage', aliases: [], category: 'vegetable', perishabilityDays: 14, per100g: { kcal: 25, protein: 1.3, carbs: 5.8, fat: 0.1, fibre: 2.5, sodium: 18, potassium: 170 } },
  { name: 'Carrots', aliases: ['carrot'], category: 'vegetable', perishabilityDays: 14, per100g: { kcal: 41, protein: 0.9, carbs: 9.6, fat: 0.2, fibre: 2.8, sodium: 69, potassium: 320 } },
  { name: 'Cucumber', aliases: [], category: 'vegetable', perishabilityDays: 7, per100g: { kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fibre: 0.5, sodium: 2, potassium: 147 } },

  // Fruit
  { name: 'Avocado', aliases: ['pear'], category: 'fruit', perishabilityDays: 5, per100g: { kcal: 160, protein: 2.0, carbs: 8.5, fat: 14.7, fibre: 6.7, sodium: 7, potassium: 485, gi: 15 } },
  { name: 'Orange', aliases: ['osan'], category: 'fruit', perishabilityDays: 14, per100g: { kcal: 47, protein: 0.9, carbs: 11.8, fat: 0.1, fibre: 2.4, sodium: 0, potassium: 181, gi: 43 } },
  { name: 'Banana', aliases: ['ogede wewe'], category: 'fruit', perishabilityDays: 5, per100g: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fibre: 2.6, sodium: 1, potassium: 358, gi: 51 } },
  { name: 'Pawpaw', aliases: ['papaya', 'ibepe'], category: 'fruit', perishabilityDays: 5, per100g: { kcal: 43, protein: 0.5, carbs: 10.8, fat: 0.3, fibre: 1.7, sodium: 8, potassium: 182, gi: 60 } },
  { name: 'Watermelon', aliases: ['egusi baara'], category: 'fruit', perishabilityDays: 7, per100g: { kcal: 30, protein: 0.6, carbs: 7.6, fat: 0.2, fibre: 0.4, sodium: 1, potassium: 112, gi: 72 } },

  // Oils, dairy and seasoning
  { name: 'Palm oil', aliases: ['epo pupa', 'mmanu'], category: 'oil', pantry: true, perishabilityDays: 365, per100g: { kcal: 884, protein: 0, carbs: 0, fat: 100, fibre: 0, sodium: 0 } },
  { name: 'Vegetable oil', aliases: ['groundnut oil', 'oil'], category: 'oil', pantry: true, perishabilityDays: 365, per100g: { kcal: 884, protein: 0, carbs: 0, fat: 100, fibre: 0, sodium: 0 } },
  { name: 'Low-fat milk', aliases: ['milk'], category: 'dairy', perishabilityDays: 5, per100g: { kcal: 42, protein: 3.4, carbs: 5.0, fat: 1.0, fibre: 0, sodium: 44, potassium: 150 } },
  { name: 'Salt', aliases: ['iyo'], category: 'seasoning', pantry: true, perishabilityDays: 3650, per100g: { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sodium: 38758 }, confidence: 'high' },
  { name: 'Seasoning cube', aliases: ['maggi', 'knorr', 'bouillon'], category: 'seasoning', pantry: true, perishabilityDays: 365, per100g: { kcal: 250, protein: 10, carbs: 30, fat: 10, fibre: 0, sodium: 22000 }, confidence: 'low' },
];

export interface SampleLocalUnit {
  /** Ingredient name, or null for a generic unit. */
  ingredient: string | null;
  name: string;
  kind: LocalUnitKind;
  grams: number;
  p10?: number;
  p90?: number;
  notes?: string;
}

// prettier-ignore
export const localUnits: SampleLocalUnit[] = [
  { ingredient: 'White rice (raw)', name: 'derica', kind: 'purchase', grams: 260, p10: 230, p90: 290, notes: 'Tomato-paste tin measure; varies by seller' },
  { ingredient: 'White rice (raw)', name: 'mudu', kind: 'purchase', grams: 1300, p10: 1100, p90: 1500 },
  { ingredient: 'Ofada rice (raw)', name: 'derica', kind: 'purchase', grams: 250, p10: 220, p90: 280 },
  { ingredient: 'Black-eyed beans (dry)', name: 'derica', kind: 'purchase', grams: 240, p10: 210, p90: 270 },
  { ingredient: 'Black-eyed beans (dry)', name: 'mudu', kind: 'purchase', grams: 1250, p10: 1050, p90: 1450 },
  { ingredient: 'Garri (cassava flakes)', name: 'derica', kind: 'purchase', grams: 200, p10: 180, p90: 230 },
  { ingredient: 'Garri (cassava flakes)', name: 'mudu', kind: 'purchase', grams: 1000, p10: 850, p90: 1150 },
  { ingredient: 'Egusi (ground melon seed)', name: 'derica', kind: 'purchase', grams: 150, p10: 130, p90: 170 },
  { ingredient: 'Ground crayfish', name: 'derica', kind: 'purchase', grams: 90, p10: 75, p90: 105 },
  { ingredient: 'Yam (raw)', name: 'tuber', kind: 'purchase', grams: 2000, p10: 1500, p90: 3000 },
  { ingredient: 'Unripe plantain', name: 'finger', kind: 'purchase', grams: 250, p10: 200, p90: 320 },
  { ingredient: 'Fluted pumpkin leaves (ugu)', name: 'bunch', kind: 'purchase', grams: 300, p10: 200, p90: 400 },
  { ingredient: 'Green amaranth (tete)', name: 'bunch', kind: 'purchase', grams: 250, p10: 180, p90: 350 },
  { ingredient: 'Tomatoes', name: 'small basket', kind: 'purchase', grams: 1500, p10: 1200, p90: 2000 },
  { ingredient: 'Eggs', name: 'crate', kind: 'purchase', grams: 1650, p10: 1550, p90: 1800, notes: '30 eggs' },
  { ingredient: 'Eggs', name: 'egg', kind: 'household', grams: 55, p10: 50, p90: 60 },
  { ingredient: 'Palm oil', name: 'cooking spoon', kind: 'household', grams: 12, p10: 10, p90: 15 },
  { ingredient: 'Vegetable oil', name: 'cooking spoon', kind: 'household', grams: 12, p10: 10, p90: 15 },
  { ingredient: null, name: 'teaspoon', kind: 'household', grams: 5 },
];

export interface SampleDish {
  name: string;
  aliases?: string[];
  description: string;
  cuisine?: Cuisine;
  mealTypes: MealType[];
  dishType: DishType;
  pairsWith?: DishType[];
  servingUnit: string;
  prepMinutes: number;
  cookMinutes: number;
  batchCookable?: boolean;
  keepsDays?: number;
  texture?: DishTexture;
  tags?: string[];
  /** [ingredient name, grams per serving] */
  ingredients: [string, number][];
  recipe?: string;
}

export const tags: { slug: string; label: string }[] = [
  { slug: 'traditional', label: 'Traditional' },
  { slug: 'high-fibre', label: 'High fibre' },
  { slug: 'low-gi', label: 'Lower glycaemic index' },
  { slug: 'quick', label: 'Quick (under 30 minutes)' },
  { slug: 'high-protein', label: 'High protein' },
  { slug: 'fried', label: 'Fried' },
];

// prettier-ignore
export const dishes: SampleDish[] = [
  // Breakfast
  { name: 'Oats with milk and banana', description: 'Rolled oats cooked in low-fat milk, topped with sliced banana.', mealTypes: ['breakfast'], dishType: 'main', servingUnit: 'bowl', prepMinutes: 2, cookMinutes: 8, texture: 'soft', tags: ['high-fibre', 'quick'],
    ingredients: [['Rolled oats', 40], ['Low-fat milk', 200], ['Banana', 60]],
    recipe: '1. Bring the milk to a gentle boil.\n2. Stir in the oats and cook for 5 minutes, stirring.\n3. Top with sliced banana. No added sugar.' },
  { name: 'Moi moi with pap', aliases: ['moin moin and akamu'], description: 'Steamed bean pudding with egg and peppers, served with maize pap.', mealTypes: ['breakfast'], dishType: 'main', servingUnit: 'plate', prepMinutes: 30, cookMinutes: 45, batchCookable: true, keepsDays: 3, texture: 'soft', tags: ['traditional', 'high-fibre', 'high-protein'],
    ingredients: [['Black-eyed beans (dry)', 60], ['Vegetable oil', 8], ['Eggs', 25], ['Red bell pepper (tatashe)', 15], ['Onions', 10], ['Ground crayfish', 3], ['Salt', 0.5], ['Maize pap powder (ogi)', 30], ['Low-fat milk', 50]] },
  { name: 'Boiled yam with egg sauce', description: 'Boiled yam with eggs scrambled in a light tomato and onion sauce.', mealTypes: ['breakfast'], dishType: 'main', servingUnit: 'plate', prepMinutes: 10, cookMinutes: 20, tags: ['traditional', 'quick'],
    ingredients: [['Yam (raw)', 150], ['Eggs', 50], ['Tomatoes', 60], ['Onions', 20], ['Vegetable oil', 8], ['Salt', 0.5]] },
  { name: 'Akara with pap', description: 'Fried bean fritters served with maize pap.', mealTypes: ['breakfast'], dishType: 'main', servingUnit: 'plate', prepMinutes: 30, cookMinutes: 20, tags: ['traditional', 'fried', 'high-protein'],
    ingredients: [['Black-eyed beans (dry)', 60], ['Onions', 10], ['Scotch bonnet pepper', 5], ['Vegetable oil', 15], ['Salt', 0.5], ['Maize pap powder (ogi)', 30], ['Low-fat milk', 50]] },
  { name: 'Whole-wheat bread with egg and tomato', description: 'Whole-wheat bread with boiled egg and sliced tomato.', mealTypes: ['breakfast'], dishType: 'main', servingUnit: 'plate', prepMinutes: 5, cookMinutes: 10, tags: ['quick'],
    ingredients: [['Whole-wheat bread', 70], ['Eggs', 50], ['Tomatoes', 50], ['Cucumber', 40]] },
  { name: 'Sweet potato with egg sauce', description: 'Boiled sweet potato with eggs in a light tomato sauce.', mealTypes: ['breakfast'], dishType: 'main', servingUnit: 'plate', prepMinutes: 10, cookMinutes: 20, tags: ['quick'],
    ingredients: [['Sweet potato', 150], ['Eggs', 50], ['Tomatoes', 50], ['Onions', 15], ['Vegetable oil', 8], ['Salt', 0.5]] },
  { name: 'Boiled plantain with egg sauce', description: 'Boiled unripe plantain with eggs in a light tomato sauce.', mealTypes: ['breakfast', 'lunch'], dishType: 'main', servingUnit: 'plate', prepMinutes: 10, cookMinutes: 20, tags: ['low-gi', 'quick'],
    ingredients: [['Unripe plantain', 150], ['Eggs', 50], ['Tomatoes', 50], ['Onions', 15], ['Vegetable oil', 8], ['Salt', 0.5]] },

  // Mains
  { name: 'Jollof rice with chicken', description: 'Rice cooked in a pepper and tomato base, with chicken.', mealTypes: ['lunch', 'dinner'], dishType: 'main', servingUnit: 'plate', prepMinutes: 20, cookMinutes: 45, batchCookable: true, keepsDays: 3, tags: ['traditional'],
    ingredients: [['White rice (raw)', 70], ['Chicken (skinless, raw)', 90], ['Tomatoes', 60], ['Red bell pepper (tatashe)', 30], ['Onions', 25], ['Vegetable oil', 12], ['Seasoning cube', 2], ['Salt', 0.5]],
    recipe: '1. Blend tomatoes, peppers and half the onion.\n2. Fry the remaining onion in the oil, add the blend and cook for 15 minutes.\n3. Add washed rice, seasoning and water to cover; cook covered on low heat until soft.\n4. Serve with grilled or boiled chicken.' },
  { name: 'Ofada rice with tomato stew and fish', description: 'Local brown rice with a pepper and tomato stew and tilapia.', mealTypes: ['lunch', 'dinner'], dishType: 'main', servingUnit: 'plate', prepMinutes: 20, cookMinutes: 50, batchCookable: true, keepsDays: 3, tags: ['traditional', 'high-fibre', 'low-gi'],
    ingredients: [['Ofada rice (raw)', 70], ['Tilapia (raw)', 100], ['Tomatoes', 80], ['Red bell pepper (tatashe)', 30], ['Onions', 20], ['Vegetable oil', 10], ['Seasoning cube', 1.5]] },
  { name: 'Beans porridge with plantain', aliases: ['ewa and plantain'], description: 'Black-eyed beans cooked soft with unripe plantain and palm oil.', mealTypes: ['lunch', 'dinner'], dishType: 'main', servingUnit: 'plate', prepMinutes: 10, cookMinutes: 60, batchCookable: true, keepsDays: 3, texture: 'soft', tags: ['traditional', 'high-fibre', 'low-gi', 'high-protein'],
    ingredients: [['Black-eyed beans (dry)', 70], ['Unripe plantain', 80], ['Palm oil', 8], ['Onions', 20], ['Scotch bonnet pepper', 5], ['Ground crayfish', 3], ['Salt', 0.5]] },
  { name: 'Yam porridge with greens', aliases: ['asaro'], description: 'Yam cooked soft in a palm-oil pepper sauce with ugu leaves.', mealTypes: ['lunch', 'dinner'], dishType: 'main', servingUnit: 'plate', prepMinutes: 15, cookMinutes: 30, texture: 'soft', tags: ['traditional'],
    ingredients: [['Yam (raw)', 180], ['Fluted pumpkin leaves (ugu)', 40], ['Palm oil', 8], ['Dried fish', 15], ['Ground crayfish', 3], ['Onions', 20], ['Scotch bonnet pepper', 5], ['Salt', 0.5]] },
  { name: 'Spaghetti with vegetables and chicken', description: 'Spaghetti in a light tomato sauce with carrots, cabbage and chicken.', mealTypes: ['lunch', 'dinner'], dishType: 'main', servingUnit: 'plate', prepMinutes: 15, cookMinutes: 25, tags: ['quick'],
    ingredients: [['Spaghetti (dry)', 60], ['Chicken (skinless, raw)', 70], ['Carrots', 30], ['Cabbage', 30], ['Tomatoes', 50], ['Vegetable oil', 8], ['Seasoning cube', 1.5]] },
  { name: 'Vegetable salad with grilled chicken', description: 'Cabbage, carrot, cucumber, tomato and avocado with grilled chicken.', mealTypes: ['lunch', 'dinner'], dishType: 'main', servingUnit: 'bowl', prepMinutes: 15, cookMinutes: 15, tags: ['high-fibre', 'low-gi', 'high-protein', 'quick'],
    ingredients: [['Chicken (skinless, raw)', 100], ['Cabbage', 60], ['Carrots', 40], ['Cucumber', 50], ['Tomatoes', 50], ['Avocado', 40]] },
  { name: 'Fried rice with chicken', description: 'Rice stir-fried with carrots, cabbage and onions, with chicken.', mealTypes: ['lunch', 'dinner'], dishType: 'main', servingUnit: 'plate', prepMinutes: 20, cookMinutes: 40, batchCookable: true, keepsDays: 3,
    ingredients: [['White rice (raw)', 70], ['Chicken (skinless, raw)', 80], ['Carrots', 30], ['Cabbage', 20], ['Onions', 20], ['Vegetable oil', 10], ['Seasoning cube', 1.5]] },
  { name: 'Grilled fish with boiled plantain', description: 'Grilled mackerel with boiled unripe plantain and a fresh pepper sauce.', mealTypes: ['lunch', 'dinner'], dishType: 'main', servingUnit: 'plate', prepMinutes: 15, cookMinutes: 30, tags: ['low-gi', 'high-protein'],
    ingredients: [['Mackerel (raw)', 120], ['Unripe plantain', 150], ['Tomatoes', 50], ['Onions', 20], ['Scotch bonnet pepper', 5], ['Vegetable oil', 5]] },
  { name: 'Goat meat pepper soup', description: 'Light, spicy broth with goat meat. Eaten on its own.', mealTypes: ['dinner'], dishType: 'main', servingUnit: 'bowl', prepMinutes: 10, cookMinutes: 60, batchCookable: true, keepsDays: 3, tags: ['traditional', 'high-protein'],
    ingredients: [['Goat meat (raw)', 120], ['Onions', 20], ['Scotch bonnet pepper', 5], ['Seasoning cube', 1], ['Salt', 0.8]] },

  // Soups (eaten with a swallow)
  { name: 'Efo riro', description: 'Rich vegetable soup of green amaranth with peppers, beef and fish.', mealTypes: ['lunch', 'dinner'], dishType: 'soup', pairsWith: ['swallow'], servingUnit: 'ladle', prepMinutes: 25, cookMinutes: 30, batchCookable: true, keepsDays: 4, tags: ['traditional', 'high-fibre'],
    ingredients: [['Green amaranth (tete)', 150], ['Palm oil', 12], ['Lean beef (raw)', 60], ['Dried fish', 10], ['Locust beans (iru)', 5], ['Red bell pepper (tatashe)', 30], ['Onions', 20], ['Ground crayfish', 4], ['Seasoning cube', 1], ['Salt', 0.5]] },
  { name: 'Egusi soup', description: 'Ground melon seed soup with ugu leaves, beef and fish.', mealTypes: ['lunch', 'dinner'], dishType: 'soup', pairsWith: ['swallow'], servingUnit: 'ladle', prepMinutes: 20, cookMinutes: 40, batchCookable: true, keepsDays: 4, tags: ['traditional', 'high-protein'],
    ingredients: [['Egusi (ground melon seed)', 35], ['Fluted pumpkin leaves (ugu)', 60], ['Palm oil', 10], ['Lean beef (raw)', 60], ['Dried fish', 10], ['Ground crayfish', 4], ['Onions', 15], ['Scotch bonnet pepper', 5], ['Seasoning cube', 1], ['Salt', 0.5]] },
  { name: 'Okra soup', description: 'Draw soup of chopped okra with ugu and tilapia.', mealTypes: ['lunch', 'dinner'], dishType: 'soup', pairsWith: ['swallow'], servingUnit: 'ladle', prepMinutes: 15, cookMinutes: 25, batchCookable: true, keepsDays: 3, texture: 'soft', tags: ['traditional', 'high-fibre'],
    ingredients: [['Okra', 120], ['Fluted pumpkin leaves (ugu)', 30], ['Palm oil', 8], ['Tilapia (raw)', 80], ['Ground crayfish', 4], ['Scotch bonnet pepper', 5], ['Onions', 10], ['Seasoning cube', 1], ['Salt', 0.5]] },
  { name: 'Vegetable soup', aliases: ['edikang ikong'], description: 'Ugu and amaranth leaf soup with beef and dried fish.', mealTypes: ['lunch', 'dinner'], dishType: 'soup', pairsWith: ['swallow'], servingUnit: 'ladle', prepMinutes: 25, cookMinutes: 30, batchCookable: true, keepsDays: 4, tags: ['traditional', 'high-fibre'],
    ingredients: [['Fluted pumpkin leaves (ugu)', 100], ['Green amaranth (tete)', 80], ['Palm oil', 12], ['Lean beef (raw)', 60], ['Dried fish', 10], ['Ground crayfish', 4], ['Onions', 10], ['Seasoning cube', 1], ['Salt', 0.5]] },

  // Swallows
  { name: 'Eba', description: 'Garri stirred into hot water.', mealTypes: ['lunch', 'dinner'], dishType: 'swallow', pairsWith: ['soup'], servingUnit: 'wrap', prepMinutes: 2, cookMinutes: 3, texture: 'soft', tags: ['traditional', 'quick'],
    ingredients: [['Garri (cassava flakes)', 60]] },
  { name: 'Amala', description: 'Yam flour swallow.', mealTypes: ['lunch', 'dinner'], dishType: 'swallow', pairsWith: ['soup'], servingUnit: 'wrap', prepMinutes: 2, cookMinutes: 8, texture: 'soft', tags: ['traditional'],
    ingredients: [['Yam flour (elubo)', 60]] },
  { name: 'Pounded yam', description: 'Boiled yam pounded smooth.', mealTypes: ['lunch', 'dinner'], dishType: 'swallow', pairsWith: ['soup'], servingUnit: 'wrap', prepMinutes: 10, cookMinutes: 25, texture: 'soft', tags: ['traditional'],
    ingredients: [['Yam (raw)', 180]] },
  { name: 'Semovita', description: 'Semolina swallow.', mealTypes: ['lunch', 'dinner'], dishType: 'swallow', pairsWith: ['soup'], servingUnit: 'wrap', prepMinutes: 2, cookMinutes: 8, texture: 'soft',
    ingredients: [['Semolina', 60]] },
  { name: 'Unripe plantain amala', aliases: ['amala ogede'], description: 'Swallow made from unripe plantain flour; slower to raise blood sugar.', mealTypes: ['lunch', 'dinner'], dishType: 'swallow', pairsWith: ['soup'], servingUnit: 'wrap', prepMinutes: 2, cookMinutes: 8, texture: 'soft', tags: ['low-gi', 'high-fibre'],
    ingredients: [['Unripe plantain flour', 60]] },
  { name: 'Oat swallow', description: 'Swallow made from blended oats.', mealTypes: ['lunch', 'dinner'], dishType: 'swallow', pairsWith: ['soup'], servingUnit: 'wrap', prepMinutes: 5, cookMinutes: 8, texture: 'soft', tags: ['low-gi', 'high-fibre'],
    ingredients: [['Rolled oats', 55]] },

  // Snacks
  { name: 'Roasted groundnuts', description: 'A small handful of roasted groundnuts.', mealTypes: ['snack'], dishType: 'snack', servingUnit: 'handful', prepMinutes: 0, cookMinutes: 0, tags: ['low-gi'],
    ingredients: [['Groundnuts (roasted)', 25]] },
  { name: 'Orange', description: 'One medium orange.', mealTypes: ['snack'], dishType: 'snack', servingUnit: 'piece', prepMinutes: 1, cookMinutes: 0, tags: ['low-gi'],
    ingredients: [['Orange', 150]] },
  { name: 'Garden egg with groundnuts', description: 'Fresh garden eggs with a few roasted groundnuts.', mealTypes: ['snack'], dishType: 'snack', servingUnit: 'plate', prepMinutes: 2, cookMinutes: 0, tags: ['traditional', 'low-gi', 'high-fibre'],
    ingredients: [['Garden egg', 100], ['Groundnuts (roasted)', 15]] },
  { name: 'Pawpaw slices', description: 'A bowl of fresh pawpaw.', mealTypes: ['snack'], dishType: 'snack', servingUnit: 'bowl', prepMinutes: 3, cookMinutes: 0, texture: 'soft',
    ingredients: [['Pawpaw', 150]] },
  { name: 'Watermelon', description: 'Two slices of watermelon.', mealTypes: ['snack'], dishType: 'snack', servingUnit: 'slice', prepMinutes: 2, cookMinutes: 0, texture: 'soft',
    ingredients: [['Watermelon', 200]] },
  { name: 'Banana', description: 'One medium banana.', mealTypes: ['snack'], dishType: 'snack', servingUnit: 'piece', prepMinutes: 0, cookMinutes: 0, texture: 'soft',
    ingredients: [['Banana', 100]] },
];
