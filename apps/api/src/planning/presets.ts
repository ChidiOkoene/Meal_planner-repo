import { type MealType, type PlannerTargets } from '@dyjext/planner';
import { type PlannerPresetId } from '@dyjext/shared';

export interface PlannerPreset {
  id: PlannerPresetId;
  label: string;
  description: string;
  mealsPerDay: MealType[];
  targets: PlannerTargets;
  softTextureOnly?: boolean;
}

const MEALS: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

/**
 * ILLUSTRATIVE limits for the development preview only. Real limits are set and signed by a
 * dietitian for each person (issue #19); these values must never be used for a real recipient.
 */
export const PLANNER_PRESETS: Record<PlannerPresetId, PlannerPreset> = {
  diabetes_hypertension: {
    id: 'diabetes_hypertension',
    label: 'Type 2 diabetes and high blood pressure',
    description: 'Carbs spread evenly across meals, salt kept low, enough fibre and protein.',
    mealsPerDay: MEALS,
    targets: {
      perMeal: {
        breakfast: { carbsG: { min: 20, max: 55 }, energyKcal: { max: 550 } },
        lunch: { carbsG: { min: 30, max: 65 }, sodiumMg: { max: 900 }, energyKcal: { max: 750 } },
        dinner: { carbsG: { min: 30, max: 65 }, sodiumMg: { max: 900 }, energyKcal: { max: 750 } },
        snack: { carbsG: { max: 25 }, energyKcal: { max: 250 } },
      },
      perDay: {
        carbsG: { min: 130, max: 210 },
        sodiumMg: { max: 2300 },
        energyKcal: { min: 1200, max: 2100 },
        proteinG: { min: 50 },
        fibreG: { min: 20 },
      },
    },
  },
  diabetes: {
    id: 'diabetes',
    label: 'Type 2 diabetes',
    description: 'Carbs spread evenly across meals with a daily range; more fibre.',
    mealsPerDay: MEALS,
    targets: {
      perMeal: {
        breakfast: { carbsG: { min: 20, max: 55 } },
        lunch: { carbsG: { min: 30, max: 65 } },
        dinner: { carbsG: { min: 30, max: 65 } },
        snack: { carbsG: { max: 25 } },
      },
      perDay: {
        carbsG: { min: 130, max: 220 },
        energyKcal: { min: 1300, max: 2200 },
        fibreG: { min: 20 },
      },
    },
  },
  hypertension: {
    id: 'hypertension',
    label: 'High blood pressure',
    description: 'Salt kept low at every meal and across the day.',
    mealsPerDay: MEALS,
    targets: {
      perMeal: { lunch: { sodiumMg: { max: 800 } }, dinner: { sodiumMg: { max: 800 } } },
      perDay: {
        sodiumMg: { max: 2000 },
        energyKcal: { min: 1300, max: 2200 },
        fibreG: { min: 20 },
      },
    },
  },
  chewing_difficulty: {
    id: 'chewing_difficulty',
    label: 'Diabetes with chewing difficulty',
    description: 'Soft dishes only, with diabetes limits.',
    mealsPerDay: MEALS,
    softTextureOnly: true,
    targets: {
      perMeal: {
        breakfast: { carbsG: { max: 55 } },
        lunch: { carbsG: { min: 30, max: 65 } },
        dinner: { carbsG: { min: 30, max: 65 } },
        snack: { carbsG: { max: 25 } },
      },
      perDay: { carbsG: { min: 120, max: 220 }, energyKcal: { min: 1200, max: 2200 } },
    },
  },
};
