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

**Hard rules** (never traded for preferences): per-meal limits, per-day limits, cooks per dish per week (a batch eaten over two days counts once), budget.

**Soft preferences** (`DEFAULT_WEIGHTS`): favourites, variety (no repeats on consecutive days, little use beyond twice a week), fewer repeats from recent weeks, ingredient reuse, standard portions, helpful tags, shorter cooking for people who cook for themselves.

If the best plan still breaks a hard rule, `status` is `infeasible` and `unmet` lists each problem. Such a plan goes to a dietitian; it is never sent automatically.

## Versioning

`ENGINE_VERSION` is stored with every plan. Change it whenever the algorithm or default weights change, so past plans can be reproduced and explained.
