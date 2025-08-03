import 'reflect-metadata';
import express from 'express';
import { createConnection } from 'typeorm';
import userRoutes from './routes/user.routes';
import dishRoutes from './routes/dish.routes';
import mealplanRoutes from './routes/mealplan.routes';
import nutritionRoutes from './routes/nutrition.routes'; // Added nutrition routes
import recipeGuideRoutes from './routes/recipe-guide.routes'; // New recipe guide routes

// Create Express application
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware for JSON parsing
app.use(express.json());

/**
 * Initialize database connection and start server
 */
createConnection().then(async connection => {
  console.log('📦 Database connection established');

  // Register API routes
  app.use('/api/users', userRoutes);
  app.use('/api/dishes', dishRoutes); // Dish routes
  app.use('/api/mealplans', mealplanRoutes);
  app.use('/api/nutrition', nutritionRoutes); // Nutrition routes
  app.use('/api/recipe-guides', recipeGuideRoutes); // Recipe guide routes

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'OK', 
      timestamp: new Date(),
      database: connection.isConnected ? 'connected' : 'disconnected'
    });
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔗 API available at http://localhost:${PORT}/api`);
  });
}).catch(error => {
  console.error('❌ Database connection error:', error);
  process.exit(1);
});