import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { NutritionFacts } from './NutritionFacts';
import { Cuisine } from './User';

/**
 * Dish Entity
 * Represents a single food item in the database
 * 
 * @property {number} id - Auto-generated primary key
 * @property {string} name - Name of the dish
 * @property {Cuisine} cuisine - Culinary tradition category
 * @property {string} description - Brief description of the dish
 * @property {string} imageUrl - URL to dish image
 * @property {string} mealType - Category (breakfast, lunch, dinner, snack)
 * @property {number} prepTime - Preparation time in minutes
 * @property {number} cookTime - Cooking time in minutes
 * @property {NutritionFacts} nutrition - Associated nutrition facts
 */
@Entity()
export class Dish {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: Cuisine
  })
  cuisine: Cuisine;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({
    type: 'enum',
    enum: ['breakfast', 'lunch', 'dinner', 'snack'],
    default: 'dinner'
  })
  mealType: string;

  @Column({ default: 15 })
  prepTime: number;

  @Column({ default: 30 })
  cookTime: number;

  @OneToOne(() => NutritionFacts, { cascade: true, eager: true })
  @JoinColumn()
  nutrition: NutritionFacts;
}