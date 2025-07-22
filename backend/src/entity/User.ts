import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * User Goal Types Enumeration
 * Defines possible nutritional goals for users
 */
export enum GoalType {
  WEIGHT_LOSS = 'weight_loss',
  MUSCLE_BUILDING = 'muscle_building',
  FAMILY = 'family',
  MAINTENANCE = 'maintenance'
}

/**
 * Supported Cuisines Enumeration
 * Represents the six supported culinary traditions
 */
export enum Cuisine {
  NIGERIA = 'nigeria',
  CAMEROON = 'cameroon',
  GHANA = 'ghana',
  KENYA = 'kenya',
  SOUTH_AFRICA = 'south_africa',
  USA = 'usa'
}

/**
 * User Entity
 * Represents application users and their dietary preferences
 * 
 * @property {number} id - Auto-generated primary key
 * @property {string} name - User's full name
 * @property {number} age - User's age in years
 * @property {number} weight - User's weight in kilograms
 * @property {number} height - User's height in centimeters
 * @property {GoalType} goal - User's nutritional goal
 * @property {Cuisine} defaultCuisine - User's preferred cuisine
 * @property {string} dietaryRestrictions - Comma-separated restrictions
 * @property {Date} createdAt - Timestamp of account creation
 */
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  age: number;

  @Column('float')
  weight: number;

  @Column('float')
  height: number;

  @Column({
    type: 'enum',
    enum: GoalType,
    default: GoalType.MAINTENANCE
  })
  goal: GoalType;

  @Column({
    type: 'enum',
    enum: Cuisine,
    default: Cuisine.NIGERIA
  })
  defaultCuisine: Cuisine;

  @Column({ nullable: true })
  dietaryRestrictions: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}