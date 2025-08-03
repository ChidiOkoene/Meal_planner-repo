require('dotenv').config();

/**
 * TypeORM Configuration
 * Defines database connection parameters for different environments
 */
module.exports = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'meal_user',
  password: process.env.DB_PASSWORD || 'meal_pass',
  database: process.env.DB_NAME || 'meal_planner',
  entities: [__dirname + '/src/entities/**/*.ts'],
  migrations: [__dirname + '/src/migrations/**/*.ts'],
  cli: {
    migrationsDir: 'src/migrations',
  },
  synchronize: false, // Always use migrations in production
  logging: process.env.NODE_ENV !== 'production',
};