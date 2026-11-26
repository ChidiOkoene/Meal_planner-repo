// Meal-planning engine. Pure and deterministic: no database or network access.
// See docs/ARCHITECTURE.md §9.
export { DEFAULT_WEIGHTS, ENGINE_VERSION, generatePlan } from './generate.js';
export { bandViolation, describeViolations, LIMITED_NUTRIENTS } from './bands.js';
export { buildMealOptions, PORTIONS, type MealOption } from './options.js';
export type * from './types.js';
