// backend/src/entity/User.ts
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @Column()
  age: number

  @Column('float')
  weight: number

  @Column('float')
  height: number

  @Column({
    type: "enum",
    enum: GoalType,
    default: GoalType.MAINTENANCE
  })
  goal: GoalType

  @Column({
    type: "enum",
    enum: Cuisine,
    default: Cuisine.NIGERIA
  })
  defaultCuisine: Cuisine
}
