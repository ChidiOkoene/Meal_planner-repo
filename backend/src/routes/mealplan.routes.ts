import express from 'express';
import { getRepository } from 'typeorm';
import { MealPlan } from '../entities/MealPlan';
import { User } from '../entities/User';

const router = express.Router();

/**
 * POST /mealplans
 * Create a new meal plan for a user
 * 
 * Request Body:
 *   { userId, startDate, days: [{ date, meals: [...] }] }
 */
router.post('/', async (req, res) => {
  try {
    const mealPlanRepo = getRepository(MealPlan);
    const userRepo = getRepository(User);
    
    // Verify user exists
    const user = await userRepo.findOne(req.body.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const newMealPlan = mealPlanRepo.create({
      startDate: req.body.startDate,
      user: user,
      days: req.body.days
    });
    
    const result = await mealPlanRepo.save(newMealPlan);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error creating meal plan', error: error.message });
  }
});

/**
 * GET /mealplans/user/:userId
 * Get all meal plans for a specific user
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const mealPlanRepo = getRepository(MealPlan);
    const plans = await mealPlanRepo.find({
      where: { user: req.params.userId },
      order: { startDate: 'DESC' }
    });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving meal plans', error: error.message });
  }
});

export default router;