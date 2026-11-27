# @dyjext/nutrition

Nutrient maths and local unit conversion. Pure functions with no database or network access. See `docs/ARCHITECTURE.md` §9.4.

## What's here

| Function                                              | Purpose                                                                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `dishNutrition(ingredients)`                          | Nutrients in one serving, summed from ingredients (per 100 g × grams). Reports ingredients with no nutrient data. |
| `nutrientsForGrams`, `scaleNutrients`, `sumNutrients` | Building blocks for portions, servings, days and weeks.                                                           |
| `roundNutrients`, `nutrientsToCsv`                    | Display rounding and CSV export. A real zero is kept; only unknown values are omitted.                            |
| `purchaseQuantity(grams, units)`                      | How much to buy in market units (derica, mudu, bunch), always rounding up.                                        |
| `snapPortion`, `describePortion`                      | Portion multipliers in quarter steps, and text like "1½ wraps of Eba".                                            |

## Rules

- Units: kcal for energy; mg for sodium and potassium; g for everything else.
- `potassiumMg` is `null` when any contributing ingredient lacks a value, so a partial total is never shown as complete.
- Tests keep 100% coverage (enforced in `vitest.config.ts`). Every number a parent or dietitian sees passes through here.
