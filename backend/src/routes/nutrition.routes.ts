import express from 'express';
import { getRepository } from 'typeorm';
import { NutritionFacts } from '../entities/NutritionFacts';
import { generateNutritionCSV } from '../utils/nutrientCalculator';

const router = express.Router();

/**
 * GET /nutrition
 * Retrieve all nutrition facts records
 * 
 * Response: Array of NutritionFacts entities
 */
router.get('/', async (req, res) => {
  try {
    const nutritionRepo = getRepository(NutritionFacts);
    const nutritionFacts = await nutritionRepo.find();
    res.json(nutritionFacts);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error retrieving nutrition facts', 
      error: error.message 
    });
  }
});

/**
 * GET /nutrition/:id
 * Retrieve specific nutrition facts by ID
 * 
 * Response: NutritionFacts entity
 */
router.get('/:id', async (req, res) => {
  try {
    const nutritionRepo = getRepository(NutritionFacts);
    const nutrition = await nutritionRepo.findOne(req.params.id);
    
    if (!nutrition) {
      return res.status(404).json({ message: 'Nutrition facts not found' });
    }
    
    res.json(nutrition);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error retrieving nutrition facts', 
      error: error.message 
    });
  }
});

/**
 * POST /nutrition/calculate
 * Calculate nutrition values for a given set of ingredients
 * 
 * Request Body: Array of nutrition components to sum
 *   [
 *     { calories: number, protein: number, carbs: number, fats: number },
 *     ...
 *   ]
 * 
 * Response: Aggregated nutrition facts object
 */
router.post('/calculate', async (req, res) => {
  try {
    const components = req.body;
    
    if (!Array.isArray(components) {
      return res.status(400).json({ message: 'Invalid input format' });
    }
    
    const result = components.reduce(
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
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error calculating nutrition', 
      error: error.message 
    });
  }
});

/**
 * POST /nutrition/export-csv
 * Export nutrition data as CSV
 * 
 * Request Body: NutritionFacts object
 * 
 * Response: CSV file download
 */
router.post('/export-csv', (req, res) => {
  try {
    const nutrition = req.body;
    const csv = generateNutritionCSV(nutrition);
    
    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=nutrition.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error generating CSV', 
      error: error.message 
    });
  }
});

export default router;