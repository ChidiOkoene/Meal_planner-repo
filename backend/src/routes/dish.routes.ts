import express from 'express';
import { getRepository } from 'typeorm';
import { Dish } from '../entities/Dish';
import { NutritionFacts } from '../entities/NutritionFacts';
import { calculateNutrition } from '../utils/nutrientCalculator';

const router = express.Router();

/**
 * GET /dishes
 * Retrieve all dishes with optional filtering by cuisine, meal type, or name
 * 
 * Query Parameters:
 *   cuisine? - Filter by specific cuisine (e.g., nigeria, ghana)
 *   mealType? - Filter by meal type (breakfast, lunch, dinner, snack)
 *   name? - Search by dish name (case-insensitive partial match)
 * 
 * Response: Array of Dish entities with associated nutrition facts
 */
router.get('/', async (req, res) => {
  try {
    const dishRepo = getRepository(Dish);
    const query = dishRepo
      .createQueryBuilder('dish')
      .leftJoinAndSelect('dish.nutrition', 'nutrition');
    
    // Apply cuisine filter if provided
    if (req.query.cuisine) {
      query.andWhere('dish.cuisine = :cuisine', { cuisine: req.query.cuisine });
    }
    
    // Apply meal type filter if provided
    if (req.query.mealType) {
      query.andWhere('dish.mealType = :mealType', { mealType: req.query.mealType });
    }
    
    // Apply name search if provided
    if (req.query.name) {
      query.andWhere('LOWER(dish.name) LIKE LOWER(:name)', { name: `%${req.query.name}%` });
    }
    
    const dishes = await query.getMany();
    res.json(dishes);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error retrieving dishes', 
      error: error.message 
    });
  }
});

/**
 * GET /dishes/:id
 * Retrieve a single dish by ID with associated nutrition facts
 * 
 * Response: Dish entity with nested nutrition information
 */
router.get('/:id', async (req, res) => {
  try {
    const dishRepo = getRepository(Dish);
    const dish = await dishRepo.findOne(req.params.id, {
      relations: ['nutrition']
    });
    
    if (!dish) {
      return res.status(404).json({ message: 'Dish not found' });
    }
    
    res.json(dish);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error retrieving dish', 
      error: error.message 
    });
  }
});

/**
 * POST /dishes
 * Create a new dish with associated nutrition facts
 * 
 * Request Body:
 *   {
 *     name: string,
 *     cuisine: string,
 *     description?: string,
 *     imageUrl?: string,
 *     mealType: string,
 *     prepTime: number,
 *     cookTime: number,
 *     nutrition: {
 *       calories: number,
 *       protein: number,
 *       carbs: number,
 *       fats: number,
 *       fiber?: number,
 *       sugar?: number,
 *       sodium?: number
 *     }
 *   }
 * 
 * Response: Created Dish entity with nutrition facts
 */
router.post('/', async (req, res) => {
  try {
    const dishRepo = getRepository(Dish);
    const nutritionRepo = getRepository(NutritionFacts);
    
    // Create nutrition facts first
    const nutrition = nutritionRepo.create(req.body.nutrition);
    await nutritionRepo.save(nutrition);
    
    // Create dish with reference to nutrition facts
    const dish = dishRepo.create({
      ...req.body,
      nutrition: nutrition
    });
    
    const result = await dishRepo.save(dish);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error creating dish', 
      error: error.message 
    });
  }
});

/**
 * POST /dishes/:id/calculate-nutrition
 * Calculate scaled nutrition facts for a specific number of portions
 * 
 * Request Body: { portions: number }
 * 
 * Response: Scaled nutrition facts object
 */
router.post('/:id/calculate-nutrition', async (req, res) => {
  try {
    const dishRepo = getRepository(Dish);
    const dish = await dishRepo.findOne(req.params.id, {
      relations: ['nutrition']
    });
    
    if (!dish) {
      return res.status(404).json({ message: 'Dish not found' });
    }
    
    if (!dish.nutrition) {
      return res.status(400).json({ message: 'Nutrition data missing for dish' });
    }
    
    const portions = req.body.portions || 1;
    const scaledNutrition = calculateNutrition(dish.nutrition, portions);
    
    res.json({
      dishId: dish.id,
      dishName: dish.name,
      portions: portions,
      nutrition: scaledNutrition
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error calculating nutrition', 
      error: error.message 
    });
  }
});

export default router;