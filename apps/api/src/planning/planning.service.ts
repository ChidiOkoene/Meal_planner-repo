import { Inject, Injectable } from '@nestjs/common';
import {
  type CatalogueDish,
  explainPlan,
  generatePlan,
  type PlanExplanation,
  type PlannerResult,
  type PlanToValidate,
  toPlannerDish,
  validatePlan,
  type ValidationResult,
} from '@dyjext/planner';
import { plannerPreviewRequestSchema, type PlannerPreviewRequest } from '@dyjext/shared';
import { type DishWithDetail, CatalogueService } from '../catalogue/catalogue.service.js';
import { PLANNER_PRESETS, type PlannerPreset } from './presets.js';

export interface PlannerPreviewResponse {
  preset: Pick<PlannerPreset, 'id' | 'label' | 'description' | 'targets'>;
  plan: PlannerResult;
  validation: Pick<ValidationResult, 'status' | 'problems'>;
  explanation: PlanExplanation;
  catalogue: { dishes: number; verified: number };
}

@Injectable()
export class PlanningService {
  constructor(@Inject(CatalogueService) private readonly catalogue: CatalogueService) {}

  listPresets() {
    return Object.values(PLANNER_PRESETS).map(
      ({ id, label, description, targets, softTextureOnly }) => ({
        id,
        label,
        description,
        targets,
        softTextureOnly: softTextureOnly ?? false,
      }),
    );
  }

  /**
   * Development preview: plan a week for an example profile using the current catalogue,
   * drafts included. Runs the engine, the independent validator and the explanations.
   */
  async preview(request: PlannerPreviewRequest): Promise<PlannerPreviewResponse> {
    const input = plannerPreviewRequestSchema.parse(request);
    const preset = PLANNER_PRESETS[input.presetId];
    const dishes = (await this.catalogue.listPlannableDishes({ includeDrafts: true })).map(
      toCatalogueDish,
    );
    const dates = nextWeek(new Date());
    const exclusions = {
      ingredientIds: input.excludedIngredientIds,
      softTextureOnly: input.softTextureOnly || preset.softTextureOnly === true,
    };
    const preferences = { favouriteFamilyIds: input.favouriteFamilyIds, cooking: input.cooking };

    const plan = generatePlan(
      {
        dates,
        mealsPerDay: preset.mealsPerDay,
        dishes: dishes.map(toPlannerDish),
        targets: preset.targets,
        exclusions,
        preferences,
      },
      { seed: input.seed },
    );

    const planToValidate: PlanToValidate = {
      days: plan.days.map((day) => ({
        date: day.date,
        meals: day.meals.map((meal) => ({
          mealType: meal.mealType,
          items: meal.items.map((item) => ({ dishId: item.dishId, portion: item.portion })),
        })),
      })),
    };
    const validation = validatePlan(planToValidate, {
      catalogue: dishes,
      targets: preset.targets,
      exclusions,
      allowDrafts: true,
    });
    const explanation = explainPlan(planToValidate, validation.recomputed, {
      catalogue: dishes,
      targets: preset.targets,
      preferences,
    });

    return {
      preset: {
        id: preset.id,
        label: preset.label,
        description: preset.description,
        targets: preset.targets,
      },
      plan,
      validation: { status: validation.status, problems: validation.problems },
      explanation,
      catalogue: {
        dishes: dishes.length,
        verified: dishes.filter((d) => d.verificationStatus === 'dietitian_verified').length,
      },
    };
  }
}

/** Database dish → the planner's raw catalogue shape (per-100 g nutrients per ingredient). */
export function toCatalogueDish(dish: DishWithDetail): CatalogueDish {
  return {
    id: dish.id,
    familyId: dish.familyId,
    version: dish.version,
    name: dish.name,
    mealTypes: dish.mealTypes,
    dishType: dish.dishType,
    pairsWith: dish.pairsWith,
    servingUnit: dish.servingUnit,
    texture: dish.texture,
    batchCookable: dish.batchCookable,
    keepsDays: dish.keepsDays,
    prepMinutes: dish.prepMinutes,
    cookMinutes: dish.cookMinutes,
    tags: dish.tags.map((t) => t.tag.slug),
    verificationStatus: dish.verificationStatus,
    costPerServingMinor: null, // prices arrive in issue #15
    ingredients: dish.ingredients.map((row) => {
      const n = row.ingredient.nutrientProfile;
      return {
        ingredientId: row.ingredientId,
        name: row.ingredient.name,
        gramsPerServing: row.gramsPerServing,
        isOptional: row.isOptional,
        per100g: n
          ? {
              energyKcal: n.energyKcal,
              proteinG: n.proteinG,
              carbsG: n.carbsG,
              fatG: n.fatG,
              fibreG: n.fibreG,
              sodiumMg: n.sodiumMg,
              potassiumMg: n.potassiumMg,
            }
          : null,
      };
    }),
  };
}

/** The seven ISO dates of next week, Monday first. */
export function nextWeek(today: Date): string[] {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const daysUntilMonday = (8 - start.getUTCDay()) % 7 || 7;
  start.setUTCDate(start.getUTCDate() + daysUntilMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });
}
