import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial Database Migration
 * Creates all required tables for the meal planner application
 */
export class CreateTables1680000000000 implements MigrationInterface {
  name = 'CreateTables1680000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create Users Table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "age" INTEGER NOT NULL,
        "weight" FLOAT NOT NULL,
        "height" FLOAT NOT NULL,
        "goal" VARCHAR(20) NOT NULL DEFAULT 'maintenance',
        "default_cuisine" VARCHAR(20) NOT NULL DEFAULT 'nigeria',
        "dietary_restrictions" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create NutritionFacts Table
    await queryRunner.query(`
      CREATE TABLE "nutrition_facts" (
        "id" SERIAL PRIMARY KEY,
        "calories" FLOAT NOT NULL,
        "protein" FLOAT NOT NULL,
        "carbs" FLOAT NOT NULL,
        "fats" FLOAT NOT NULL,
        "fiber" FLOAT,
        "sugar" FLOAT,
        "sodium" FLOAT
      )
    `);

    // Create Dishes Table
    await queryRunner.query(`
      CREATE TABLE "dishes" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "cuisine" VARCHAR(20) NOT NULL,
        "description" TEXT,
        "image_url" VARCHAR(255),
        "meal_type" VARCHAR(20) NOT NULL DEFAULT 'dinner',
        "prep_time" INTEGER NOT NULL DEFAULT 15,
        "cook_time" INTEGER NOT NULL DEFAULT 30,
        "nutrition_id" INTEGER REFERENCES "nutrition_facts"("id") ON DELETE CASCADE
      )
    `);

    // Create MealPlans Table
    await queryRunner.query(`
      CREATE TABLE "meal_plans" (
        "id" SERIAL PRIMARY KEY,
        "start_date" DATE NOT NULL,
        "user_id" INTEGER REFERENCES "users"("id") ON DELETE CASCADE,
        "days" JSONB NOT NULL,
        "shopping_list" JSONB
      )
    `);

    // Create RecipeGuides Table
    await queryRunner.query(`
      CREATE TABLE "recipe_guides" (
        "id" SERIAL PRIMARY KEY,
        "dish_id" INTEGER REFERENCES "dishes"("id") ON DELETE CASCADE,
        "content" TEXT NOT NULL,
        "difficulty" VARCHAR(20) NOT NULL DEFAULT 'medium',
        "equipment" TEXT
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "recipe_guides"`);
    await queryRunner.query(`DROP TABLE "meal_plans"`);
    await queryRunner.query(`DROP TABLE "dishes"`);
    await queryRunner.query(`DROP TABLE "nutrition_facts"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}