// Meal-planning engine, validator and explanations. Pure and deterministic:
// no database or network access. See docs/ARCHITECTURE.md §9.
export { DEFAULT_WEIGHTS, ENGINE_VERSION, generatePlan } from './generate.js';
export { bandViolation, describeViolations, LIMITED_NUTRIENTS } from './bands.js';
export { buildMealOptions, PORTIONS, type MealOption } from './options.js';
export { toPlannerDish, type CatalogueDish } from './catalogue.js';
export {
  validatePlan,
  type PlanToValidate,
  type Problem,
  type ProblemRule,
  type RecomputedPlan,
  type ValidationContext,
  type ValidationResult,
} from './validate.js';
export {
  checkLimits,
  explainPlan,
  NUTRIENT_LABELS,
  type CheckStatus,
  type ItemExplanation,
  type LimitCheck,
  type PlanExplanation,
} from './explain.js';
export type * from './types.js';
