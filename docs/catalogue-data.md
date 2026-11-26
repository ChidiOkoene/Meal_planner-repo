# Catalogue data: how to enter and import it

The food catalogue (ingredients, nutrients, market units, dishes, recipes) is maintained in a spreadsheet and imported with one command. The planner only uses dishes a dietitian has verified, so data entry and verification are what make the product safe.

## The spreadsheet

Use one Google Sheet (or Excel file) with six tabs. Export each tab as CSV into one folder, named exactly:

| File                   | One row per                                                    | Required |
| ---------------------- | -------------------------------------------------------------- | -------- |
| `ingredients.csv`      | ingredient, with nutrients per 100 g as purchased              | yes      |
| `dishes.csv`           | dish                                                           | yes      |
| `dish_ingredients.csv` | ingredient in a dish, in grams per serving                     | yes      |
| `units.csv`            | market or kitchen measure (derica, mudu, bunch, cooking spoon) | no       |
| `recipes.csv`          | recipe for a dish, per language                                | no       |
| `tags.csv`             | tag, e.g. `high-fibre`                                         | no       |

`packages/db/prisma/seed-data/catalogue/` is a complete example in this format (the development sample). Copy it as your starting template.

**Conventions**

- Lists are separated by `;`, e.g. `lunch; dinner`.
- Yes/no columns accept `yes` or `no`.
- Leave a cell blank for "none" or "unknown".
- Names link the files together: `dish_ingredients.csv` refers to dishes and ingredients by their exact names (capitals don't matter).
- Recipe steps can span several lines inside one cell.

### `ingredients.csv`

| Column                                                                 | Example                   | Notes                                                                                |
| ---------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------ |
| `name`                                                                 | `Yam (raw)`               | Say raw/dry when it matters; values are per 100 g as purchased                       |
| `aliases`                                                              | `isu; ji; doya`           | Local names in Yoruba, Igbo, Hausa, Pidgin                                           |
| `category`                                                             | `staple`                  | staple, legume, protein, vegetable, fruit, oil, seasoning, dairy, nut_seed, beverage |
| `pantry_staple`                                                        | `no`                      | `yes` for oil, salt, seasoning: bought monthly, not weekly                           |
| `perishability_days`                                                   | `30`                      | Days it keeps after purchase                                                         |
| `energy_kcal`, `protein_g`, `carbs_g`, `fat_g`, `fibre_g`, `sodium_mg` | `118` …                   | Required, per 100 g                                                                  |
| `potassium_mg`, `glycaemic_index`                                      | `816`, `54`               | Optional; GI only where a published value exists                                     |
| `source`                                                               | `wafct_2019`              | wafct_2019, kenya_fct, usda_fooddata, lab_analysis, product_label, estimate          |
| `source_reference`                                                     | `WAFCT 2019, code 02_012` | Table and row, URL or lab report id                                                  |
| `confidence`                                                           | `high`                    | high, medium, low                                                                    |

### `dishes.csv`

| Column                         | Example                   | Notes                                                            |
| ------------------------------ | ------------------------- | ---------------------------------------------------------------- |
| `name`                         | `Efo riro`                | Unique                                                           |
| `aliases`                      | `edikang ikong`           | Other names                                                      |
| `cuisine`                      | `nigerian`                | nigerian, cameroonian, ghanaian, kenyan, south_african, american |
| `description`                  |                           | One sentence                                                     |
| `meal_types`                   | `lunch; dinner`           | breakfast, lunch, dinner, snack                                  |
| `dish_type`                    | `soup`                    | main, soup, swallow, side, snack, drink                          |
| `pairs_with`                   | `swallow`                 | A soup must pair with `swallow`, or the planner never serves it  |
| `serving_unit`                 | `ladle`                   | What one serving is called: plate, wrap, ladle, bowl, piece      |
| `prep_minutes`, `cook_minutes` | `25`, `30`                |                                                                  |
| `batch_cookable`               | `yes`                     | Cooked once, eaten over several days                             |
| `keeps_days`                   | `4`                       | Days it keeps after cooking                                      |
| `texture`                      | `regular`                 | `soft` for people with chewing difficulty                        |
| `tags`                         | `traditional; high-fibre` | Must exist in `tags.csv` (or already in the database)            |

### `dish_ingredients.csv`

`dish`, `ingredient`, `grams_per_serving` (raw, as purchased), `optional` (yes/no), `preparation` (e.g. "chopped").

### `units.csv`

`ingredient` (blank for a generic unit such as teaspoon), `unit` (singular), `kind` (`purchase` for market measures, `household` for kitchen ones), `grams` (typical), `grams_p10` and `grams_p90` (the usual range; measures vary by seller), `notes`.

## Importing

Always dry-run first. It checks everything and shows what would change, without saving:

```bash
pnpm catalogue:import path/to/folder --dry-run
```

Then import:

```bash
pnpm catalogue:import path/to/folder
```

- **All or nothing.** If any row has an error, nothing is imported. Errors and warnings name the file and line.
- **Safe to repeat.** Unchanged rows are left alone; importing the same folder twice changes nothing.
- **Verified dishes are protected.** If a verified dish's row changes, the change is saved as a new draft version. The verified version stays in use until a dietitian verifies the new one. Retired dishes are never changed.
- **Imported dishes start as drafts.** A dietitian verifies each one in the staff console (issue #14).

**Warnings to act on:**

- Ingredients with `estimate` nutrients.
- Energy that doesn't match protein, carbs and fat (often a typo).
- Soups that don't pair with a swallow.

## Data sources and licences

Record the source of every nutrient value. Candidate sources:

- **FAO/INFOODS West African Food Composition Table (2019).** The closest match for Nigerian and Ghanaian ingredients.
- **Kenya Food Composition Tables.** For the Kenyan launch.
- **USDA FoodData Central.** For ingredients not in the African tables. It is public domain.
- **Lab analysis.** For the most-served dishes, if budget allows.

⚠️ **Check the licence before commercial use.** FAO publications are often released under Creative Commons licences that restrict commercial use (for example CC BY-NC-SA 3.0 IGO). Confirm the exact terms of each table you use, and ask FAO for permission if needed, before the data is used in the paid service. Keep the attribution each licence requires.

## Before a dish can be verified

1. Every ingredient has sourced nutrients (`source` is not `estimate`).
2. Grams per serving have been checked against a real serving, ideally weighed.
3. A dietitian has reviewed the dish's nutrients per serving in the staff console.
