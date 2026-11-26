import { type Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { type CatalogueData, type ImportProblem } from './validate.js';

export interface Counts {
  created: number;
  updated: number;
  unchanged: number;
}

export interface ImportSummary {
  dryRun: boolean;
  ingredients: Counts;
  units: Counts;
  tags: Counts;
  dishes: Counts & {
    /** Verified dishes whose spreadsheet row changed: saved as a new draft version. */
    newVersions: number;
    /** Retired dishes are never changed by an import. */
    skippedRetired: number;
  };
  warnings: ImportProblem[];
}

class DryRunRollback extends Error {
  constructor(readonly summary: ImportSummary) {
    super('dry run');
  }
}

const counts = (): Counts => ({ created: 0, updated: 0, unchanged: 0 });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Write a validated catalogue in one transaction: all of it or none of it.
 * - Ingredients, nutrients, units and tags are created or updated in place.
 * - Dishes follow the versioning rules: a draft is updated in place; a verified dish whose
 *   row changed gets a new draft version (the verified one stays in use); retired dishes are
 *   left alone. Unchanged rows are not touched, so importing twice changes nothing.
 * With `dryRun`, everything runs and is then rolled back; the summary shows what would happen.
 */
export async function applyCatalogue(
  prisma: PrismaClient,
  data: CatalogueData,
  options: { dryRun?: boolean } = {},
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    dryRun: options.dryRun ?? false,
    ingredients: counts(),
    units: counts(),
    tags: counts(),
    dishes: { ...counts(), newVersions: 0, skippedRetired: 0 },
    warnings: [],
  };

  try {
    await prisma.$transaction(
      async (tx) => {
        const ingredientIds = await importIngredients(tx, data, summary);
        await importUnits(tx, data, summary, ingredientIds);
        const tagIds = await importTags(tx, data, summary);
        await importDishes(tx, data, summary, ingredientIds, tagIds);
        if (options.dryRun) throw new DryRunRollback(summary);
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
  } catch (error) {
    if (error instanceof DryRunRollback) return error.summary;
    throw error;
  }
  return summary;
}

type Tx = Prisma.TransactionClient;

async function importIngredients(tx: Tx, data: CatalogueData, summary: ImportSummary) {
  const ids = new Map<string, string>();
  for (const { row } of data.ingredients) {
    const fields = {
      name: row.name,
      aliases: row.aliases,
      category: row.category,
      isPantryStaple: row.pantry_staple,
      perishabilityDays: row.perishability_days,
    };
    const nutrients = {
      energyKcal: row.energy_kcal,
      proteinG: row.protein_g,
      carbsG: row.carbs_g,
      fatG: row.fat_g,
      fibreG: row.fibre_g,
      sodiumMg: row.sodium_mg,
      potassiumMg: row.potassium_mg,
      glycaemicIndex: row.glycaemic_index,
      source: row.source,
      sourceReference: row.source_reference,
      confidence: row.confidence,
    };
    const existing = await tx.ingredient.findFirst({
      where: { name: { equals: row.name, mode: 'insensitive' } },
      include: { nutrientProfile: true },
    });
    if (!existing) {
      const created = await tx.ingredient.create({
        data: { ...fields, nutrientProfile: { create: nutrients } },
      });
      ids.set(row.name.toLowerCase(), created.id);
      summary.ingredients.created++;
      continue;
    }
    ids.set(row.name.toLowerCase(), existing.id);
    const current = {
      name: existing.name,
      aliases: existing.aliases,
      category: existing.category,
      isPantryStaple: existing.isPantryStaple,
      perishabilityDays: existing.perishabilityDays,
    };
    const p = existing.nutrientProfile;
    const currentNutrients = p && {
      energyKcal: p.energyKcal,
      proteinG: p.proteinG,
      carbsG: p.carbsG,
      fatG: p.fatG,
      fibreG: p.fibreG,
      sodiumMg: p.sodiumMg,
      potassiumMg: p.potassiumMg,
      glycaemicIndex: p.glycaemicIndex,
      source: p.source,
      sourceReference: p.sourceReference,
      confidence: p.confidence,
    };
    if (same(current, fields) && same(currentNutrients, nutrients)) {
      summary.ingredients.unchanged++;
      continue;
    }
    await tx.ingredient.update({
      where: { id: existing.id },
      data: {
        ...fields,
        nutrientProfile: { upsert: { create: nutrients, update: nutrients } },
      },
    });
    summary.ingredients.updated++;
  }
  return ids;
}

async function importUnits(
  tx: Tx,
  data: CatalogueData,
  summary: ImportSummary,
  ingredientIds: Map<string, string>,
) {
  for (const { row } of data.units) {
    const ingredientId = row.ingredient ? ingredientIds.get(row.ingredient.toLowerCase())! : null;
    const fields = {
      kind: row.kind,
      grams: row.grams,
      gramsP10: row.grams_p10,
      gramsP90: row.grams_p90,
      notes: row.notes,
    };
    // A compound unique key with a null column can't be used in upsert, so look it up first.
    const existing = await tx.localUnit.findFirst({ where: { ingredientId, name: row.unit } });
    if (!existing) {
      await tx.localUnit.create({ data: { ingredientId, name: row.unit, ...fields } });
      summary.units.created++;
    } else if (
      same(
        {
          kind: existing.kind,
          grams: existing.grams,
          gramsP10: existing.gramsP10,
          gramsP90: existing.gramsP90,
          notes: existing.notes,
        },
        fields,
      )
    ) {
      summary.units.unchanged++;
    } else {
      await tx.localUnit.update({ where: { id: existing.id }, data: fields });
      summary.units.updated++;
    }
  }
}

async function importTags(tx: Tx, data: CatalogueData, summary: ImportSummary) {
  const ids = new Map<string, string>();
  for (const { row } of data.tags) {
    const existing = await tx.tag.findUnique({ where: { slug: row.slug } });
    if (!existing) {
      ids.set(row.slug, (await tx.tag.create({ data: row })).id);
      summary.tags.created++;
    } else {
      ids.set(row.slug, existing.id);
      if (existing.label === row.label) {
        summary.tags.unchanged++;
      } else {
        await tx.tag.update({ where: { id: existing.id }, data: { label: row.label } });
        summary.tags.updated++;
      }
    }
  }
  // Tags referenced by dishes but already in the database (not in tags.csv) are allowed too.
  for (const tag of await tx.tag.findMany()) if (!ids.has(tag.slug)) ids.set(tag.slug, tag.id);
  return ids;
}

async function importDishes(
  tx: Tx,
  data: CatalogueData,
  summary: ImportSummary,
  ingredientIds: Map<string, string>,
  tagIds: Map<string, string>,
) {
  for (const { row, line } of data.dishes) {
    const key = row.name.toLowerCase();
    const fields = {
      name: row.name,
      aliases: row.aliases,
      cuisine: row.cuisine,
      description: row.description,
      mealTypes: row.meal_types,
      dishType: row.dish_type,
      pairsWith: row.pairs_with,
      servingUnit: row.serving_unit,
      prepMinutes: row.prep_minutes,
      cookMinutes: row.cook_minutes,
      batchCookable: row.batch_cookable,
      keepsDays: row.keeps_days,
      texture: row.texture,
    };
    const ingredients = data.dishIngredients
      .filter(({ row: r }) => r.dish.toLowerCase() === key)
      .map(({ row: r }, index) => ({
        ingredientId: ingredientIds.get(r.ingredient.toLowerCase())!,
        gramsPerServing: r.grams_per_serving,
        isOptional: r.optional,
        preparation: r.preparation,
        sortOrder: index,
      }));
    const tags = row.tags.map((slug) => tagIds.get(slug)!).sort();
    const recipes = data.recipes
      .filter(({ row: r }) => r.dish.toLowerCase() === key)
      .map(({ row: r }) => ({
        language: r.language,
        difficulty: r.difficulty,
        equipment: r.equipment,
        steps: r.steps,
      }))
      .sort((a, b) => a.language.localeCompare(b.language));
    const children = {
      ingredients: { create: ingredients },
      tags: { create: tags.map((tagId) => ({ tagId })) },
      recipes: { create: recipes },
    };

    const match = await tx.dish.findFirst({
      where: { name: { equals: row.name, mode: 'insensitive' } },
    });
    if (!match) {
      const created = await tx.dish.create({
        data: { familyId: '00000000-0000-0000-0000-000000000000', ...fields, ...children },
      });
      await tx.dish.update({ where: { id: created.id }, data: { familyId: created.id } });
      summary.dishes.created++;
      continue;
    }

    const latest = await tx.dish.findFirstOrThrow({
      where: { familyId: match.familyId },
      orderBy: { version: 'desc' },
      include: { ingredients: { orderBy: { sortOrder: 'asc' } }, tags: true, recipes: true },
    });
    const current = {
      fields: {
        name: latest.name,
        aliases: latest.aliases,
        cuisine: latest.cuisine,
        description: latest.description,
        mealTypes: latest.mealTypes,
        dishType: latest.dishType,
        pairsWith: latest.pairsWith,
        servingUnit: latest.servingUnit,
        prepMinutes: latest.prepMinutes,
        cookMinutes: latest.cookMinutes,
        batchCookable: latest.batchCookable,
        keepsDays: latest.keepsDays,
        texture: latest.texture,
      },
      ingredients: latest.ingredients.map((i) => ({
        ingredientId: i.ingredientId,
        gramsPerServing: i.gramsPerServing,
        isOptional: i.isOptional,
        preparation: i.preparation,
        sortOrder: i.sortOrder,
      })),
      tags: latest.tags.map((t) => t.tagId).sort(),
      recipes: latest.recipes
        .map((r) => ({
          language: r.language,
          difficulty: r.difficulty,
          equipment: r.equipment,
          steps: r.steps,
        }))
        .sort((a, b) => a.language.localeCompare(b.language)),
    };
    if (same(current, { fields, ingredients, tags, recipes })) {
      summary.dishes.unchanged++;
      continue;
    }

    if (latest.verificationStatus === 'retired') {
      summary.dishes.skippedRetired++;
      summary.warnings.push({
        severity: 'warning',
        file: 'dishes.csv',
        line,
        message: `"${row.name}" is retired, so its changes were not imported`,
      });
    } else if (latest.verificationStatus === 'draft') {
      await tx.dishIngredient.deleteMany({ where: { dishId: latest.id } });
      await tx.dishTag.deleteMany({ where: { dishId: latest.id } });
      await tx.recipe.deleteMany({ where: { dishId: latest.id } });
      await tx.dish.update({ where: { id: latest.id }, data: { ...fields, ...children } });
      summary.dishes.updated++;
    } else {
      await tx.dish.create({
        data: {
          familyId: latest.familyId,
          version: latest.version + 1,
          verificationStatus: 'draft',
          ...fields,
          ...children,
        },
      });
      summary.dishes.newVersions++;
    }
  }
}
