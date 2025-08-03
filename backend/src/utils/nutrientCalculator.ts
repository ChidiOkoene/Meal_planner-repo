import { NutritionFacts } from '../entities/NutritionFacts';

/**
 * Calculate Nutrition for Portions
 * Scales nutrition facts based on number of portions
 * 
 * @param nutrition - Base nutrition facts for one serving
 * @param portions - Number of servings
 * @returns Scaled nutrition facts object
 */
export function calculateNutrition(
  nutrition: NutritionFacts, 
  portions: number
): NutritionFacts {
  if (!nutrition || portions <= 0) {
    throw new Error('Invalid input for nutrition calculation');
  }

  return {
    calories: parseFloat((nutrition.calories * portions).toFixed(2)),
    protein: parseFloat((nutrition.protein * portions).toFixed(2)),
    carbs: parseFloat((nutrition.carbs * portions).toFixed(2)),
    fats: parseFloat((nutrition.fats * portions).toFixed(2)),
    fiber: nutrition.fiber ? parseFloat((nutrition.fiber * portions).toFixed(2)) : undefined,
    sugar: nutrition.sugar ? parseFloat((nutrition.sugar * portions).toFixed(2)) : undefined,
    sodium: nutrition.sodium ? parseFloat((nutrition.sodium * portions).toFixed(2)) : undefined
  };
}

/**
 * Generate Nutrition CSV
 * Creates CSV-formatted nutrition data
 * 
 * @param nutrition - Nutrition facts to format
 * @returns CSV string with nutrition data
 */
export function generateNutritionCSV(nutrition: NutritionFacts): string {
  const headers = 'Nutrient,Amount,Unit\n';
  
  const rows = [
    `Calories,${nutrition.calories || 0},kcal`,
    `Protein,${nutrition.protein || 0},g`,
    `Carbohydrates,${nutrition.carbs || 0},g`,
    `Fats,${nutrition.fats || 0},g`,
    nutrition.fiber ? `Fiber,${nutrition.fiber},g` : '',
    nutrition.sugar ? `Sugar,${nutrition.sugar},g` : '',
    nutrition.sodium ? `Sodium,${nutrition.sodium},mg` : ''
  ].filter(Boolean).join('\n');

  return headers + rows;
}

/**
 * Aggregate Nutrition Facts
 * Sums nutrition values from multiple dishes/ingredients
 * 
 * @param items - Array of nutrition facts objects
 * @returns Combined nutrition facts
 */
export function aggregateNutrition(
  items: Partial<NutritionFacts>[]
): NutritionFacts {
  return items.reduce(
    (total, current) => {
      return {
        calories: (total.calories || 0) + (current.calories || 0),
        protein: (total.protein || 0) + (current.protein || 0),
        carbs: (total.carbs || 0) + (current.carbs || 0),
        fats: (total.fats || 0) + (current.fats || 0),
        fiber: (total.fiber || 0) + (current.fiber || 0),
        sugar: (total.sugar || 0) + (current.sugar || 0),
        sodium: (total.sodium || 0) + (current.sodium || 0)
      };
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 } as NutritionFacts
  );
}