import express from 'express';
import { getRepository } from 'typeorm';
import { User } from '../entities/User';

const router = express.Router();

/**
 * POST /users
 * Create a new user profile
 * 
 * Request Body:
 *   { name, age, weight, height, goal, defaultCuisine, dietaryRestrictions? }
 */
router.post('/', async (req, res) => {
  try {
    const userRepo = getRepository(User);
    const newUser = userRepo.create(req.body);
    const result = await userRepo.save(newUser);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
});

/**
 * GET /users/:id
 * Retrieve a user profile by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const userRepo = getRepository(User);
    const user = await userRepo.findOne(req.params.id);
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving user', error: error.message });
  }
});

/**
 * PUT /users/:id
 * Update a user profile
 */
router.put('/:id', async (req, res) => {
  try {
    const userRepo = getRepository(User);
    const user = await userRepo.findOne(req.params.id);
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    userRepo.merge(user, req.body);
    const result = await userRepo.save(user);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error updating user', error: error.message });
  }
});

export default router;