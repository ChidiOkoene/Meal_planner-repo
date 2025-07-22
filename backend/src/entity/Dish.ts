
// backend/src/entity/Dish.ts
@Entity()
export class Dish {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @Column({
    type: "enum",
    enum: Cuisine
  })
  cuisine: Cuisine

  @OneToOne(() => NutritionFacts)
  @JoinColumn()
  nutrition: NutritionFacts
}