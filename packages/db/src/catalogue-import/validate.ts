import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { type z } from 'zod';
import {
  CATALOGUE_FILES,
  type DishIngredientRow,
  type DishRow,
  type IngredientRow,
  type RecipeRow,
  type TagRow,
  type UnitRow,
} from './schemas.js';

export interface ImportProblem {
  severity: 'error' | 'warning';
  file: string;
  /** Line in the CSV file (the header is line 1). */
  line?: number;
  message: string;
}

export interface Located<T> {
  row: T;
  line: number;
}

export interface CatalogueData {
  ingredients: Located<IngredientRow>[];
  units: Located<UnitRow>[];
  dishes: Located<DishRow>[];
  dishIngredients: Located<DishIngredientRow>[];
  recipes: Located<RecipeRow>[];
  tags: Located<TagRow>[];
}

type FileName = keyof typeof CATALOGUE_FILES;

/** Read and validate a catalogue folder. Never touches the database. */
export function readCatalogue(dir: string): { data: CatalogueData; problems: ImportProblem[] } {
  const problems: ImportProblem[] = [];

  function load<T>(file: FileName): Located<T>[] {
    const { schema, required } = CATALOGUE_FILES[file];
    const path = join(dir, file);
    if (!existsSync(path)) {
      if (required) problems.push({ severity: 'error', file, message: 'File is missing' });
      return [];
    }
    let records: { record: Record<string, string>; info: { lines: number } }[];
    try {
      records = parse<{ record: Record<string, string>; info: { lines: number } }>(
        readFileSync(path),
        {
          columns: true,
          bom: true,
          skip_empty_lines: true,
          info: true,
        },
      );
    } catch (error) {
      problems.push({
        severity: 'error',
        file,
        message: `Not a valid CSV file: ${(error as Error).message}`,
      });
      return [];
    }
    const expected = Object.keys((schema as z.ZodObject).shape);
    const header = records[0] ? Object.keys(records[0].record) : [];
    const missingColumns = expected.filter((c) => records.length > 0 && !header.includes(c));
    if (missingColumns.length > 0) {
      problems.push({
        severity: 'error',
        file,
        line: 1,
        message: `Missing columns: ${missingColumns.join(', ')}`,
      });
      return [];
    }

    const rows: Located<T>[] = [];
    for (const { record, info } of records) {
      // info.lines is the last line of the record; multi-line cells (recipe steps) span several.
      const line = info.lines;
      const result = schema.safeParse(record);
      if (result.success) {
        rows.push({ row: result.data as T, line });
      } else {
        for (const issue of result.error.issues) {
          problems.push({
            severity: 'error',
            file,
            line,
            message: `${issue.path.join('.') || 'row'}: ${issue.message}`,
          });
        }
      }
    }
    return rows;
  }

  const data: CatalogueData = {
    ingredients: load<IngredientRow>('ingredients.csv'),
    units: load<UnitRow>('units.csv'),
    dishes: load<DishRow>('dishes.csv'),
    dishIngredients: load<DishIngredientRow>('dish_ingredients.csv'),
    recipes: load<RecipeRow>('recipes.csv'),
    tags: load<TagRow>('tags.csv'),
  };

  checkReferences(data, problems);
  return { data, problems };
}

/** Cross-file checks: duplicates, unknown names, and data a dietitian should look at. */
function checkReferences(data: CatalogueData, problems: ImportProblem[]): void {
  const duplicates = <T>(file: string, rows: Located<T>[], key: (row: T) => string) => {
    const seen = new Map<string, number>();
    for (const { row, line } of rows) {
      const k = key(row).toLowerCase();
      const first = seen.get(k);
      if (first !== undefined) {
        problems.push({
          severity: 'error',
          file,
          line,
          message: `Duplicate of line ${first}: "${key(row)}"`,
        });
      } else {
        seen.set(k, line);
      }
    }
  };
  duplicates('ingredients.csv', data.ingredients, (r) => r.name);
  duplicates('dishes.csv', data.dishes, (r) => r.name);
  duplicates('units.csv', data.units, (r) => `${r.ingredient ?? '(any)'} / ${r.unit}`);
  duplicates('dish_ingredients.csv', data.dishIngredients, (r) => `${r.dish} / ${r.ingredient}`);
  duplicates('recipes.csv', data.recipes, (r) => `${r.dish} / ${r.language}`);
  duplicates('tags.csv', data.tags, (r) => r.slug);

  const ingredients = new Set(data.ingredients.map(({ row }) => row.name.toLowerCase()));
  const dishes = new Set(data.dishes.map(({ row }) => row.name.toLowerCase()));
  const tags = new Set(data.tags.map(({ row }) => row.slug));

  for (const { row, line } of data.units) {
    if (row.ingredient && !ingredients.has(row.ingredient.toLowerCase())) {
      problems.push({
        severity: 'error',
        file: 'units.csv',
        line,
        message: `Unknown ingredient "${row.ingredient}"`,
      });
    }
    if (
      row.grams_p10 !== null &&
      row.grams_p90 !== null &&
      !(row.grams_p10 <= row.grams && row.grams <= row.grams_p90)
    ) {
      problems.push({
        severity: 'error',
        file: 'units.csv',
        line,
        message: 'grams must lie between grams_p10 and grams_p90',
      });
    }
  }
  for (const { row, line } of data.dishIngredients) {
    if (!dishes.has(row.dish.toLowerCase())) {
      problems.push({
        severity: 'error',
        file: 'dish_ingredients.csv',
        line,
        message: `Unknown dish "${row.dish}"`,
      });
    }
    if (!ingredients.has(row.ingredient.toLowerCase())) {
      problems.push({
        severity: 'error',
        file: 'dish_ingredients.csv',
        line,
        message: `Unknown ingredient "${row.ingredient}"`,
      });
    }
  }
  for (const { row, line } of data.recipes) {
    if (!dishes.has(row.dish.toLowerCase())) {
      problems.push({
        severity: 'error',
        file: 'recipes.csv',
        line,
        message: `Unknown dish "${row.dish}"`,
      });
    }
  }

  const withIngredients = new Set(data.dishIngredients.map(({ row }) => row.dish.toLowerCase()));
  for (const { row, line } of data.dishes) {
    if (!withIngredients.has(row.name.toLowerCase())) {
      problems.push({
        severity: 'error',
        file: 'dishes.csv',
        line,
        message: `"${row.name}" has no ingredients in dish_ingredients.csv`,
      });
    }
    for (const tag of row.tags) {
      if (!tags.has(tag)) {
        problems.push({
          severity: 'error',
          file: 'dishes.csv',
          line,
          message: `Unknown tag "${tag}" (add it to tags.csv)`,
        });
      }
    }
    if (row.dish_type === 'soup' && !row.pairs_with.includes('swallow')) {
      problems.push({
        severity: 'warning',
        file: 'dishes.csv',
        line,
        message: `Soup "${row.name}" does not pair with a swallow, so the planner will never serve it`,
      });
    }
  }

  for (const { row, line } of data.ingredients) {
    if (row.source === 'estimate') {
      problems.push({
        severity: 'warning',
        file: 'ingredients.csv',
        line,
        message: `"${row.name}" has estimated nutrients; dishes using it should not be verified`,
      });
    }
    const macroKcal = row.protein_g * 4 + row.carbs_g * 4 + row.fat_g * 9;
    if (
      row.energy_kcal > 0 &&
      Math.abs(macroKcal - row.energy_kcal) / row.energy_kcal > 0.25 &&
      row.energy_kcal > 50
    ) {
      problems.push({
        severity: 'warning',
        file: 'ingredients.csv',
        line,
        message: `"${row.name}": energy ${row.energy_kcal} kcal differs by more than 25% from protein/carbs/fat (${Math.round(macroKcal)} kcal); check the values`,
      });
    }
  }
}
