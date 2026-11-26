import { z } from 'zod';
import { idSchema } from './common.js';

// These enums mirror the Prisma enums in packages/db. The web app can't import Prisma,
// so they are repeated here; an API test fails if the two lists ever differ.

export const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type MealType = z.infer<typeof mealTypeSchema>;

export const dishTypeSchema = z.enum(['main', 'soup', 'swallow', 'side', 'snack', 'drink']);
export type DishType = z.infer<typeof dishTypeSchema>;

export const dishTextureSchema = z.enum(['regular', 'soft']);

export const dishVerificationSchema = z.enum(['draft', 'dietitian_verified', 'retired']);
export type DishVerification = z.infer<typeof dishVerificationSchema>;

export const cuisineSchema = z.enum([
  'nigerian',
  'cameroonian',
  'ghanaian',
  'kenyan',
  'south_african',
  'american',
]);

export const ingredientCategorySchema = z.enum([
  'staple',
  'legume',
  'protein',
  'vegetable',
  'fruit',
  'oil',
  'seasoning',
  'dairy',
  'nut_seed',
  'beverage',
]);

/** Query for `GET /v1/ops/dishes`. Returns the latest version of each dish. */
export const dishListQuerySchema = z.object({
  status: dishVerificationSchema.optional(),
  mealType: mealTypeSchema.optional(),
  dishType: dishTypeSchema.optional(),
  /** Case-insensitive match on name or alias. */
  q: z.string().trim().min(1).max(100).optional(),
});
export type DishListQuery = z.infer<typeof dishListQuerySchema>;

const dishIngredientInputSchema = z.object({
  ingredientId: idSchema,
  gramsPerServing: z.number().positive().max(2000),
  isOptional: z.boolean().default(false),
  preparation: z.string().trim().max(100).nullish(),
});

/**
 * Changes to a dish. On a draft they are applied in place; on a verified dish they create
 * the next version as a draft. Ingredients, when given, replace the full list.
 */
export const dishChangesSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    aliases: z.array(z.string().trim().min(1).max(80)).max(20),
    description: z.string().trim().max(1000).nullable(),
    mealTypes: z.array(mealTypeSchema).min(1),
    dishType: dishTypeSchema,
    pairsWith: z.array(dishTypeSchema),
    servingUnit: z.string().trim().min(1).max(30),
    prepMinutes: z.number().int().min(0).max(1440),
    cookMinutes: z.number().int().min(0).max(1440),
    batchCookable: z.boolean(),
    keepsDays: z.number().int().min(0).max(30).nullable(),
    texture: dishTextureSchema,
    ingredients: z.array(dishIngredientInputSchema).min(1).max(40),
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, 'At least one change is required');
export type DishChanges = z.infer<typeof dishChangesSchema>;
