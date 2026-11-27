# @dyjext/planner

The meal-planning engine. A pure, deterministic function: no database or network access. See `docs/ARCHITECTURE.md` §9.

```ts
import { generatePlan } from '@dyjext/planner';

const result = generatePlan(input, { seed: `${recipientId}:${weekStart}` });
// result.status: 'ok' | 'infeasible'; result.days[].meals[].items[].portionText: "1½ wraps of Eba"
```

## Inputs

- **Dishes** with nutrients per serving already computed (`@dyjext/nutrition`), plus meal types, dish type, texture, batch-cooking info, tags, ingredient ids and an optional cost.
- **Targets** signed by a dietitian: limits per meal type (e.g. lunch carbs 30–60 g) and per day (e.g. sodium ≤ 2,300 mg).
- **Exclusions**: ingredients (allergies, religious rules, dislikes), disliked dishes, soft texture only.
- **Preferences**: favourite dishes, dishes used recently, who cooks.
- **Budget** (optional), number of eaters, and cooks allowed per dish per week (default 2).

## How it works

1. **Filter**: drop excluded dishes.
2. **Meal options**: for each meal type, every single dish, and every soup + swallow pair, with the portions (½× to 1½× in quarter steps, closest to a standard serving) that keep the meal within its limits. Pairing portions is how carbs are controlled, e.g. a full ladle of soup with ¾ wrap of swallow.
3. **Construct**: fill meals greedily, the meal types with the fewest options first.
4. **Improve**: seeded simulated annealing that replaces a meal or swaps two meals of the same type.

**Hard rules** (never traded for preferences): per-meal limits, per-day limits, cooks per dish per week, budget. For the repeat limit, a batch eaten over two days counts as one cook, and for dishes needing no cooking (fruit, nuts) two servings count as one.

Every portion that fits a meal's limits is available (not only the standard one), so the engine can serve a larger or smaller portion to meet a day's minimums or maximums. Standard portions are preferred.

**Soft preferences** (`DEFAULT_WEIGHTS`): favourites, variety (no repeats on consecutive days, little use beyond twice a week), fewer repeats from recent weeks, ingredient reuse, standard portions, helpful tags, shorter cooking for people who cook for themselves.

If the best plan still breaks a hard rule, `status` is `infeasible` and `unmet` lists each problem. Such a plan goes to a dietitian; it is never sent automatically.

## Validator and explanations

`validatePlan(plan, context)` is the safety net. It shares nothing with the engine: it recomputes every meal's nutrients and the week's cost from the catalogue's raw ingredient data, then re-checks every rule (limits, exclusions, texture, verified dishes, meal types, portions, repeats, budget).

- `ok`: ready to send.
- `warnings`: a dietitian must review (missing nutrient data, budget not checkable, draft dishes in a preview).
- `failed`: must never be sent.

`explainPlan(plan, validation.recomputed, context)` turns a plan into what a dietitian reviews: each day's and meal's nutrients against limits (`within`, `near_limit` within 10%, `outside`), plain-English reasons for each dish ("Lower glycaemic index", "Leftovers from 2026-12-07", "Smaller portion to stay within the lunch limits"), and which limits were tight across the week.

`toPlannerDish(catalogueDish)` converts raw catalogue data into engine input, so the API builds both from the same source.

## Tests

- Engine behaviour, exclusions, preferences, infeasible cases and budget (`generate.test.ts`).
- Validator and explanations, including deliberately broken plans (`validate.test.ts`).
- A property test that the validator never rejects a plan the engine reported as `ok`, across random limits, exclusions, budgets and seeds: 200 cases by default; set `PLANNER_PROPERTY_RUNS=10000` for a long run.
- Golden plans for five representative recipients (`golden.test.ts`). When the engine changes, review the new snapshots, bump `ENGINE_VERSION`, and update with `-u`.

## Versioning

`ENGINE_VERSION` is stored with every plan. Change it whenever the algorithm or default weights change, so past plans can be reproduced and explained.
