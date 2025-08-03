import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';

/**
 * MealPlan Entity
 * Represents a weekly meal plan for a specific user
 * 
 * @property {number} id - Auto-generated primary key
 * @property {Date} startDate - Start date of the meal plan week
 * @property {User} user - Associated user
 * @property {object[]} days - Array of daily meal plans
 * @property {object[]} shoppingList - Consolidated shopping list
 */
@Entity()
export class MealPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  startDate: Date;

  @ManyToOne(() => User, user => user.mealPlans)
  @JoinColumn()
  user: User;

  @Column({ type: 'jsonb' })
  days: Array<{
    date: string; // ISO date string
    meals: Array<{
      mealType: string;
      dishId: number;
      portions: number;
    }>
  }>;

  @Column({ type: 'jsonb', nullable: true })
  shoppingList: Array<{
    ingredient: string;
    quantity: number;
    unit: string;
    category: string;
  }>;
}