import express from 'express';
import { getRepository } from 'typeorm';
import { RecipeGuide } from '../entities/RecipeGuide';
import { Dish } from '../entities/Dish';

const router = express.Router();

/**
 * GET /recipe-guides/dish/:dishId
 * Retrieve all recipe guides for a specific dish
 */
router.get('/dish/:dishId', async (req, res) => {
  try {
    const recipeRepo = getRepository(RecipeGuide);
    const guides = await recipeRepo.find({
      where: { dish: req.params.dishId }
    });
    
    res.json(guides);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error retrieving recipe guides', 
      error: error.message 
    });
  }
});

/**
 * POST /recipe-guides
 * Create a new recipe guide for a dish
 * 
 * Request Body:
 *   {
 *     dishId: number,
 *     content: string,
 *     difficulty?: 'easy' | 'medium' | 'hard',
 *     equipment?: string
 *   }
 */
router.post('/', async (req, res) => {
  try {
    const recipeRepo = getRepository(RecipeGuide);
    const dishRepo = getRepository(Dish);
    
    // Verify dish exists
    const dish = await dishRepo.findOne(req.body.dishId);
    if (!dish) {
      return res.status(404).json({ message: 'Dish not found' });
    }
    
    // Create recipe guide
    const newGuide = recipeRepo.create({
      content: req.body.content,
      difficulty: req.body.difficulty || 'medium',
      equipment: req.body.equipment,
      dish: dish
    });
    
    const result = await recipeRepo.save(newGuide);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error creating recipe guide', 
      error: error.message 
    });
  }
});

export default router;