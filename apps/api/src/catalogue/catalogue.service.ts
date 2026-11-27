import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma } from '@dyjext/db';
import { type DishChanges, type DishListQuery } from '@dyjext/shared';
import { PrismaService } from '../prisma/prisma.service.js';

/** Everything needed to show or plan with a dish: ingredients with nutrients, tags, recipes. */
const dishDetail = {
  ingredients: {
    orderBy: { sortOrder: 'asc' },
    include: { ingredient: { include: { nutrientProfile: true } } },
  },
  tags: { include: { tag: true } },
  recipes: true,
} satisfies Prisma.DishInclude;

export type DishWithDetail = Prisma.DishGetPayload<{ include: typeof dishDetail }>;

@Injectable()
export class CatalogueService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** The latest version of each dish (draft or verified), optionally filtered. */
  async listDishes(query: DishListQuery = {}) {
    const latest = await this.prisma.dish.findMany({
      distinct: ['familyId'],
      orderBy: [{ familyId: 'asc' }, { version: 'desc' }],
      select: { id: true },
    });
    return this.prisma.dish.findMany({
      where: {
        id: { in: latest.map((d) => d.id) },
        ...(query.status ? { verificationStatus: query.status } : {}),
        ...(query.mealType ? { mealTypes: { has: query.mealType } } : {}),
        ...(query.dishType ? { dishType: query.dishType } : {}),
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { aliases: { has: query.q.toLowerCase() } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      include: { tags: { include: { tag: true } } },
    });
  }

  /** One dish version with ingredients, nutrients, tags and recipes. */
  async getDish(id: string): Promise<DishWithDetail> {
    const dish = await this.prisma.dish.findUnique({ where: { id }, include: dishDetail });
    if (!dish) throw new NotFoundException('Dish not found');
    return dish;
  }

  /**
   * The dishes the planner may use: for each dish, its latest dietitian-verified version.
   * With `includeDrafts`, families that have no verified version yet contribute their latest
   * draft instead. Only for development previews, never for real recipients.
   */
  async listPlannableDishes(options: { includeDrafts?: boolean } = {}): Promise<DishWithDetail[]> {
    const statuses = options.includeDrafts
      ? (['dietitian_verified', 'draft'] as const)
      : (['dietitian_verified'] as const);
    const candidates = await this.prisma.dish.findMany({
      where: { verificationStatus: { in: [...statuses] } },
      orderBy: [{ familyId: 'asc' }, { version: 'desc' }],
      include: dishDetail,
    });
    const chosen = new Map<string, DishWithDetail>();
    for (const dish of candidates) {
      const current = chosen.get(dish.familyId);
      // Prefer a verified version over a newer draft of the same dish.
      if (
        !current ||
        (current.verificationStatus === 'draft' && dish.verificationStatus === 'dietitian_verified')
      ) {
        chosen.set(dish.familyId, dish);
      }
    }
    // Families whose latest version is retired are no longer offered.
    const retiredFamilies = new Set(
      (
        await this.prisma.dish.findMany({
          distinct: ['familyId'],
          orderBy: [{ familyId: 'asc' }, { version: 'desc' }],
          select: { familyId: true, verificationStatus: true },
        })
      )
        .filter((d) => d.verificationStatus === 'retired')
        .map((d) => d.familyId),
    );
    return [...chosen.values()]
      .filter((d) => !retiredFamilies.has(d.familyId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Change a dish. Only the latest version can be changed.
   * - Draft: changed in place.
   * - Verified: the change becomes the next version, as a draft. The verified version is
   *   untouched and stays in use until the new version is verified.
   */
  async updateDish(id: string, changes: DishChanges): Promise<DishWithDetail> {
    const dish = await this.getDish(id);
    await this.assertLatest(dish);
    if (dish.verificationStatus === 'retired') {
      throw new ConflictException('A retired dish cannot be changed');
    }

    const { ingredients, ...fields } = changes;

    if (dish.verificationStatus === 'draft') {
      return this.prisma.$transaction(async (tx) => {
        if (ingredients) {
          await tx.dishIngredient.deleteMany({ where: { dishId: id } });
        }
        return tx.dish.update({
          where: { id },
          data: {
            ...fields,
            ...(ingredients ? { ingredients: { create: toIngredientRows(ingredients) } } : {}),
          },
          include: dishDetail,
        });
      });
    }

    // Verified: copy into a new draft version with the changes applied.
    return this.prisma.dish.create({
      data: {
        familyId: dish.familyId,
        version: dish.version + 1,
        name: fields.name ?? dish.name,
        aliases: fields.aliases ?? dish.aliases,
        cuisine: dish.cuisine,
        description: fields.description !== undefined ? fields.description : dish.description,
        mealTypes: fields.mealTypes ?? dish.mealTypes,
        dishType: fields.dishType ?? dish.dishType,
        pairsWith: fields.pairsWith ?? dish.pairsWith,
        servingUnit: fields.servingUnit ?? dish.servingUnit,
        prepMinutes: fields.prepMinutes ?? dish.prepMinutes,
        cookMinutes: fields.cookMinutes ?? dish.cookMinutes,
        batchCookable: fields.batchCookable ?? dish.batchCookable,
        keepsDays: fields.keepsDays !== undefined ? fields.keepsDays : dish.keepsDays,
        texture: fields.texture ?? dish.texture,
        verificationStatus: 'draft',
        ingredients: {
          create: ingredients
            ? toIngredientRows(ingredients)
            : dish.ingredients.map((row) => ({
                ingredientId: row.ingredientId,
                gramsPerServing: row.gramsPerServing,
                isOptional: row.isOptional,
                preparation: row.preparation,
                sortOrder: row.sortOrder,
              })),
        },
        tags: { create: dish.tags.map((t) => ({ tagId: t.tagId })) },
        recipes: {
          create: dish.recipes.map((r) => ({
            language: r.language,
            steps: r.steps,
            difficulty: r.difficulty,
            equipment: r.equipment,
          })),
        },
      },
      include: dishDetail,
    });
  }

  /** Mark a draft dish version as verified by a dietitian. */
  async verifyDish(id: string, verifiedById: string): Promise<DishWithDetail> {
    const dish = await this.getDish(id);
    await this.assertLatest(dish);
    if (dish.verificationStatus !== 'draft') {
      throw new ConflictException(
        `Only a draft can be verified (this one is ${dish.verificationStatus})`,
      );
    }
    return this.prisma.dish.update({
      where: { id },
      data: { verificationStatus: 'dietitian_verified', verifiedById, verifiedAt: new Date() },
      include: dishDetail,
    });
  }

  listIngredients() {
    return this.prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
      include: { nutrientProfile: true },
    });
  }

  listUnits() {
    return this.prisma.localUnit.findMany({
      orderBy: [{ name: 'asc' }],
      include: { ingredient: { select: { id: true, name: true } } },
    });
  }

  private async assertLatest(dish: { familyId: string; version: number }): Promise<void> {
    const newer = await this.prisma.dish.count({
      where: { familyId: dish.familyId, version: { gt: dish.version } },
    });
    if (newer > 0) {
      throw new ConflictException('A newer version of this dish exists; change that one instead');
    }
  }
}

function toIngredientRows(ingredients: NonNullable<DishChanges['ingredients']>) {
  return ingredients.map((row, index) => ({
    ingredientId: row.ingredientId,
    gramsPerServing: row.gramsPerServing,
    isOptional: row.isOptional,
    preparation: row.preparation ?? null,
    sortOrder: index,
  }));
}
