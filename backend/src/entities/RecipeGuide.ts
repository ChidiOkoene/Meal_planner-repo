import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Dish } from './Dish';

/**
 * RecipeGuide Entity
 * Contains step-by-step cooking instructions for a dish
 * 
 * @property {number} id - Auto-generated primary key
 * @property {Dish} dish - Associated dish
 * @property {string} content - Markdown-formatted recipe instructions
 * @property {string} difficulty - Preparation difficulty level
 * @property {string} equipment - Required kitchen tools
 */
@Entity()
export class RecipeGuide {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Dish, dish => dish.recipeGuides)
  dish: Dish;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  })
  difficulty: string;

  @Column({ type: 'text', nullable: true })
  equipment: string;
}