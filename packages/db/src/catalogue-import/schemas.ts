import { z } from 'zod';
import {
  Cuisine,
  DishTexture,
  DishType,
  IngredientCategory,
  LocalUnitKind,
  MealType,
  NutrientConfidence,
  NutrientSource,
  RecipeDifficulty,
  RecipientLanguage,
} from '../generated/prisma/enums.js';

// Spreadsheet conventions: lists are separated by ";", flags are yes/no, blank means "none".

const text = z.string().trim();
const optionalText = text.transform((v) => (v === '' ? null : v));
const list = text.transform((v) =>
  v === ''
    ? []
    : v
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean),
);
const flag = text
  .transform((v) => v.toLowerCase())
  .pipe(z.enum(['yes', 'no', 'y', 'n', 'true', 'false', '']))
  .transform((v) => v === 'yes' || v === 'y' || v === 'true');
const toNumber = (v: string) => (v === '' ? Number.NaN : Number(v));
const number = (min: number, max: number) =>
  text.transform(toNumber).pipe(z.number({ error: 'Must be a number' }).min(min).max(max));
const optionalNumber = (min: number, max: number) =>
  text
    .transform((v) => (v === '' ? null : Number(v)))
    .pipe(z.number({ error: 'Must be a number' }).min(min).max(max).nullable());
const optionalInt = (min: number, max: number) =>
  text
    .transform((v) => (v === '' ? null : Number(v)))
    .pipe(z.number({ error: 'Must be a whole number' }).int().min(min).max(max).nullable());
const oneOf = <T extends Record<string, string>>(values: T) =>
  text
    .transform((v) => v.toLowerCase())
    .pipe(z.enum(Object.values(values) as [T[keyof T], ...T[keyof T][]]));
const listOf = <T extends Record<string, string>>(values: T) =>
  list.pipe(z.array(z.enum(Object.values(values) as [T[keyof T], ...T[keyof T][]])));

export const ingredientRow = z.object({
  name: text.min(1),
  aliases: list,
  category: oneOf(IngredientCategory),
  pantry_staple: flag,
  perishability_days: optionalInt(0, 3650),
  energy_kcal: number(0, 900),
  protein_g: number(0, 100),
  carbs_g: number(0, 100),
  fat_g: number(0, 100),
  fibre_g: number(0, 100),
  sodium_mg: number(0, 40_000),
  potassium_mg: optionalNumber(0, 10_000),
  glycaemic_index: optionalInt(0, 110),
  source: oneOf(NutrientSource),
  source_reference: optionalText,
  confidence: oneOf(NutrientConfidence),
});

export const unitRow = z.object({
  ingredient: optionalText,
  unit: text.min(1),
  kind: oneOf(LocalUnitKind),
  grams: number(0.01, 100_000),
  grams_p10: optionalNumber(0.01, 100_000),
  grams_p90: optionalNumber(0.01, 100_000),
  notes: optionalText,
});

export const dishRow = z.object({
  name: text.min(1),
  aliases: list,
  cuisine: oneOf(Cuisine),
  description: optionalText,
  meal_types: listOf(MealType).refine(
    (types) => types.length > 0,
    'At least one meal type is required',
  ),
  dish_type: oneOf(DishType),
  pairs_with: listOf(DishType),
  serving_unit: text.min(1),
  prep_minutes: optionalInt(0, 1440).transform((v) => v ?? 0),
  cook_minutes: optionalInt(0, 1440).transform((v) => v ?? 0),
  batch_cookable: flag,
  keeps_days: optionalInt(0, 30),
  texture: oneOf(DishTexture),
  tags: list,
});

export const dishIngredientRow = z.object({
  dish: text.min(1),
  ingredient: text.min(1),
  grams_per_serving: number(0.01, 2000),
  optional: flag,
  preparation: optionalText,
});

export const recipeRow = z.object({
  dish: text.min(1),
  language: oneOf(RecipientLanguage),
  difficulty: oneOf(RecipeDifficulty),
  equipment: optionalText,
  steps: text.min(1),
});

export const tagRow = z.object({
  slug: text.regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'Use lowercase words joined by hyphens, e.g. high-fibre',
  ),
  label: text.min(1),
});

export type IngredientRow = z.infer<typeof ingredientRow>;
export type UnitRow = z.infer<typeof unitRow>;
export type DishRow = z.infer<typeof dishRow>;
export type DishIngredientRow = z.infer<typeof dishIngredientRow>;
export type RecipeRow = z.infer<typeof recipeRow>;
export type TagRow = z.infer<typeof tagRow>;

/** Every file in a catalogue folder, its row schema, and whether it must exist. */
export const CATALOGUE_FILES = {
  'ingredients.csv': { schema: ingredientRow, required: true },
  'dishes.csv': { schema: dishRow, required: true },
  'dish_ingredients.csv': { schema: dishIngredientRow, required: true },
  'units.csv': { schema: unitRow, required: false },
  'recipes.csv': { schema: recipeRow, required: false },
  'tags.csv': { schema: tagRow, required: false },
} as const;
