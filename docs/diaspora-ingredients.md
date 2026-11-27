# Ingredients abroad: where to buy, and substitutes

For **plan-only** recipients outside Nigeria (ADR 010), the planner uses only ingredients they can buy where they live. This is the starting list for the 46 catalogue ingredients in the four launch countries.

**Status: estimated.** It was drafted from general knowledge of where Nigerian food is sold abroad, not checked shop by shop. Ops staff verify each row (and add brands and shop names) before a country opens. Recipients' "couldn't find this" replies on WhatsApp then keep it current. It becomes `availability.csv` and `substitutes.csv` in the catalogue import once the schema exists.

## Key

| Code | Where                                                                         |
| ---- | ----------------------------------------------------------------------------- |
| S    | Ordinary supermarket (sometimes only larger stores, in a "world foods" aisle) |
| A    | African or Caribbean shop (for goat meat, also halal butchers)                |
| O    | Online grocers that deliver African food                                      |
| —    | Hard to find; use the substitute or drop the dish                             |

If a recipient says at intake that they can't reach an African or Caribbean shop, `A` counts as unavailable for them (`O` still counts if they're happy to order online).

## Staples

| Ingredient             | UK  | US  | Canada | Ireland | Substitute (needs dietitian approval)                      |
| ---------------------- | --- | --- | ------ | ------- | ---------------------------------------------------------- |
| White rice (raw)       | S   | S   | S      | S       | —                                                          |
| Ofada rice (raw)       | A O | A O | A O    | O       | Brown rice (S)                                             |
| Yam (raw)              | S A | A   | A      | A       | Sweet potato (S); different GI, so portions are re-checked |
| Garri (cassava flakes) | S A | A O | A O    | A O     | None; drop the dish                                        |
| Yam flour (elubo)      | A O | A O | A O    | A O     | None; drop the dish                                        |
| Unripe plantain flour  | A O | A O | A O    | A O     | None; drop the dish                                        |
| Semolina               | S   | S   | S      | S       | —                                                          |
| Rolled oats            | S   | S   | S      | S       | —                                                          |
| Maize pap powder (ogi) | A O | A O | A O    | A O     | None; drop the dish (cornflour custard is not equivalent)  |
| Whole-wheat bread      | S   | S   | S      | S       | —                                                          |
| Spaghetti (dry)        | S   | S   | S      | S       | —                                                          |
| Unripe plantain        | S   | S   | S      | S A     | —                                                          |
| Sweet potato           | S   | S   | S      | S       | —                                                          |

## Legumes, nuts and seeds

| Ingredient                | UK  | US  | Canada | Ireland | Substitute                  |
| ------------------------- | --- | --- | ------ | ------- | --------------------------- |
| Black-eyed beans (dry)    | S   | S   | S      | S       | Canned black-eyed beans (S) |
| Egusi (ground melon seed) | A O | A O | A O    | A O     | None; drop the dish         |
| Groundnuts (roasted)      | S   | S   | S      | S       | —                           |

## Protein

| Ingredient              | UK  | US  | Canada | Ireland | Substitute                                                    |
| ----------------------- | --- | --- | ------ | ------- | ------------------------------------------------------------- |
| Chicken (skinless, raw) | S   | S   | S      | S       | —                                                             |
| Lean beef (raw)         | S   | S   | S      | S       | —                                                             |
| Goat meat (raw)         | A   | A   | A      | —       | Lean lamb (S)                                                 |
| Tilapia (raw)           | S A | S   | S      | A       | Other white fish, e.g. cod or haddock (S)                     |
| Mackerel (raw)          | S   | S   | S      | S       | —                                                             |
| Dried fish              | A O | A O | A O    | A O     | Smoked mackerel (S); salty, so checked for hypertension plans |
| Ground crayfish         | A O | A O | A O    | A O     | Leave out (flavouring); salt target re-checked                |
| Eggs                    | S   | S   | S      | S       | —                                                             |

## Vegetables

| Ingredient                  | UK  | US  | Canada | Ireland | Substitute                          |
| --------------------------- | --- | --- | ------ | ------- | ----------------------------------- |
| Fluted pumpkin leaves (ugu) | A O | A O | A O    | A O     | Spinach (S), fresh or frozen        |
| Green amaranth (tete)       | A   | A   | A      | —       | Spinach (S); callaloo (A) in the UK |
| Okra                        | S   | S   | S      | A       | Frozen okra (S or A)                |
| Tomatoes                    | S   | S   | S      | S       | —                                   |
| Onions                      | S   | S   | S      | S       | —                                   |
| Red bell pepper (tatashe)   | S   | S   | S      | S       | —                                   |
| Scotch bonnet pepper        | S   | A   | S A    | A       | Habanero or other hot chilli (S)    |
| Garden egg                  | A   | A   | A      | —       | Aubergine/eggplant (S)              |
| Cabbage                     | S   | S   | S      | S       | —                                   |
| Carrots                     | S   | S   | S      | S       | —                                   |
| Cucumber                    | S   | S   | S      | S       | —                                   |

## Fruit

| Ingredient | UK  | US  | Canada | Ireland | Substitute         |
| ---------- | --- | --- | ------ | ------- | ------------------ |
| Avocado    | S   | S   | S      | S       | —                  |
| Orange     | S   | S   | S      | S       | —                  |
| Banana     | S   | S   | S      | S       | —                  |
| Pawpaw     | S   | S   | S      | S       | — (sold as papaya) |
| Watermelon | S   | S   | S      | S       | —                  |

## Oils, dairy and seasoning

| Ingredient         | UK  | US  | Canada | Ireland | Substitute                                      |
| ------------------ | --- | --- | ------ | ------- | ----------------------------------------------- |
| Palm oil           | S A | A O | A O    | A O     | None for palm-oil soups; drop the dish          |
| Vegetable oil      | S   | S   | S      | S       | —                                               |
| Low-fat milk       | S   | S   | S      | S       | —                                               |
| Salt               | S   | S   | S      | S       | —                                               |
| Seasoning cube     | S A | S A | S A    | A       | Low-salt stock cube (S); salt target re-checked |
| Locust beans (iru) | A O | A O | A O    | A O     | Leave out (flavouring)                          |

## Rules for substitutes

- A substitute has its own nutrient profile in the catalogue; the planner and validator use it, so the plan's numbers match what's actually eaten.
- A dietitian approves each substitute once, for all recipients. Substitutes that change carbohydrate or salt a lot (yam → sweet potato, dried fish → smoked mackerel, seasoning cube → stock cube) are flagged for extra checks against diabetes and hypertension targets.
- "None; drop the dish" means the planner leaves out dishes that need that ingredient for recipients who can't get it. For example, egusi soup for someone with no African shop and no online delivery.
- Recipes sent abroad name the substitute ("spinach (instead of ugu)") so the dish still feels familiar.
