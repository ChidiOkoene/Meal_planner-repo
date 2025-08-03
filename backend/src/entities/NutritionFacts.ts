import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * NutritionFacts Entity
 * Represents nutritional information for a single serving of a dish
 * 
 * @property {number} id - Auto-generated primary key
 * @property {number} calories - Energy content in kcal
 * @property {number} protein - Protein content in grams
 * @property {number} carbs - Carbohydrates content in grams
 * @property {number} fats - Total fats content in grams
 * @property {number} fiber - Dietary fiber in grams
 * @property {number} sugar - Total sugars in grams
 * @property {number} sodium - Sodium content in milligrams
 */
@Entity()
export class NutritionFacts {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('float')
  calories: number;

  @Column('float')
  protein: number;

  @Column('float')
  carbs: number;

  @Column('float')
  fats: number;

  @Column('float', { nullable: true })
  fiber: number;

  @Column('float', { nullable: true })
  sugar: number;

  @Column('float', { nullable: true })
  sodium: number;
}