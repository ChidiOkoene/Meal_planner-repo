import { type PrismaClient } from '../src/generated/prisma/client.js';
import { dishes, ingredients, localUnits, tags } from './seed-data/catalogue.js';

/**
 * Load the sample catalogue. Ingredients, nutrients, units and tags are upserted.
 * Dishes are only created when missing, so edits made later are never overwritten.
 */
export async function seedCatalogue(prisma: PrismaClient): Promise<{ dishes: number }> {
  const ingredientIds = new Map<string, string>();

  for (const item of ingredients) {
    const data = {
      aliases: item.aliases ?? [],
      category: item.category,
      isPantryStaple: item.pantry ?? false,
      perishabilityDays: item.perishabilityDays ?? null,
    };
    const ingredient = await prisma.ingredient.upsert({
      where: { name: item.name },
      update: data,
      create: { name: item.name, ...data },
    });
    ingredientIds.set(item.name, ingredient.id);

    const n = item.per100g;
    const nutrients = {
      energyKcal: n.kcal,
      proteinG: n.protein,
      carbsG: n.carbs,
      fatG: n.fat,
      fibreG: n.fibre,
      sodiumMg: n.sodium,
      potassiumMg: n.potassium ?? null,
      glycaemicIndex: n.gi ?? null,
      source: 'estimate' as const,
      sourceReference: 'Development sample data (packages/db/prisma/seed-data/catalogue.ts)',
      confidence: item.confidence ?? ('medium' as const),
    };
    await prisma.nutrientProfile.upsert({
      where: { ingredientId: ingredient.id },
      update: nutrients,
      create: { ingredientId: ingredient.id, ...nutrients },
    });
  }

  const idOf = (name: string): string => {
    const id = ingredientIds.get(name);
    if (!id) throw new Error(`Sample catalogue references unknown ingredient "${name}"`);
    return id;
  };

  for (const unit of localUnits) {
    const ingredientId = unit.ingredient ? idOf(unit.ingredient) : null;
    const data = {
      kind: unit.kind,
      grams: unit.grams,
      gramsP10: unit.p10 ?? null,
      gramsP90: unit.p90 ?? null,
      notes: unit.notes ?? null,
    };
    // A compound unique key with a null column can't be used in upsert, so look it up first.
    const existing = await prisma.localUnit.findFirst({ where: { ingredientId, name: unit.name } });
    if (existing) {
      await prisma.localUnit.update({ where: { id: existing.id }, data });
    } else {
      await prisma.localUnit.create({ data: { ingredientId, name: unit.name, ...data } });
    }
  }

  const tagIds = new Map<string, string>();
  for (const tag of tags) {
    const row = await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: { label: tag.label },
      create: tag,
    });
    tagIds.set(tag.slug, row.id);
  }

  let created = 0;
  for (const dish of dishes) {
    if (await prisma.dish.findFirst({ where: { name: dish.name } })) continue;

    await prisma.$transaction(async (tx) => {
      const row = await tx.dish.create({
        data: {
          // Placeholder; replaced below with the dish's own id (familyId = id of version 1).
          familyId: '00000000-0000-0000-0000-000000000000',
          name: dish.name,
          aliases: dish.aliases ?? [],
          cuisine: dish.cuisine ?? 'nigerian',
          description: dish.description,
          mealTypes: dish.mealTypes,
          dishType: dish.dishType,
          pairsWith: dish.pairsWith ?? [],
          servingUnit: dish.servingUnit,
          prepMinutes: dish.prepMinutes,
          cookMinutes: dish.cookMinutes,
          batchCookable: dish.batchCookable ?? false,
          keepsDays: dish.keepsDays ?? null,
          texture: dish.texture ?? 'regular',
          ingredients: {
            create: dish.ingredients.map(([name, grams], index) => ({
              ingredientId: idOf(name),
              gramsPerServing: grams,
              sortOrder: index,
            })),
          },
          tags: {
            create: (dish.tags ?? []).map((slug) => {
              const tagId = tagIds.get(slug);
              if (!tagId) throw new Error(`Dish "${dish.name}" uses unknown tag "${slug}"`);
              return { tagId };
            }),
          },
          ...(dish.recipe
            ? { recipes: { create: { steps: dish.recipe, difficulty: 'easy' as const } } }
            : {}),
        },
      });
      await tx.dish.update({ where: { id: row.id }, data: { familyId: row.id } });
    });
    created++;
  }

  return { dishes: created };
}
