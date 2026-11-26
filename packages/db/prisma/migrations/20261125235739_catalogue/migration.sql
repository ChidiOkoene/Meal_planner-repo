-- CreateEnum
CREATE TYPE "ingredient_category" AS ENUM ('staple', 'legume', 'protein', 'vegetable', 'fruit', 'oil', 'seasoning', 'dairy', 'nut_seed', 'beverage');

-- CreateEnum
CREATE TYPE "nutrient_source" AS ENUM ('wafct_2019', 'kenya_fct', 'usda_fooddata', 'lab_analysis', 'product_label', 'estimate');

-- CreateEnum
CREATE TYPE "nutrient_confidence" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "local_unit_kind" AS ENUM ('purchase', 'household');

-- CreateEnum
CREATE TYPE "cuisine" AS ENUM ('nigerian', 'cameroonian', 'ghanaian', 'kenyan', 'south_african', 'american');

-- CreateEnum
CREATE TYPE "meal_type" AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

-- CreateEnum
CREATE TYPE "dish_type" AS ENUM ('main', 'soup', 'swallow', 'side', 'snack', 'drink');

-- CreateEnum
CREATE TYPE "dish_texture" AS ENUM ('regular', 'soft');

-- CreateEnum
CREATE TYPE "dish_verification" AS ENUM ('draft', 'dietitian_verified', 'retired');

-- CreateEnum
CREATE TYPE "recipe_difficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateTable
CREATE TABLE "ingredients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "category" "ingredient_category" NOT NULL,
    "is_pantry_staple" BOOLEAN NOT NULL DEFAULT false,
    "perishability_days" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrient_profiles" (
    "id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "energy_kcal" DOUBLE PRECISION NOT NULL,
    "protein_g" DOUBLE PRECISION NOT NULL,
    "carbs_g" DOUBLE PRECISION NOT NULL,
    "fat_g" DOUBLE PRECISION NOT NULL,
    "fibre_g" DOUBLE PRECISION NOT NULL,
    "sugars_g" DOUBLE PRECISION,
    "sodium_mg" DOUBLE PRECISION NOT NULL,
    "potassium_mg" DOUBLE PRECISION,
    "glycaemic_index" INTEGER,
    "source" "nutrient_source" NOT NULL,
    "source_reference" TEXT,
    "confidence" "nutrient_confidence" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "nutrient_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_units" (
    "id" UUID NOT NULL,
    "ingredient_id" UUID,
    "name" TEXT NOT NULL,
    "kind" "local_unit_kind" NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,
    "grams_p10" DOUBLE PRECISION,
    "grams_p90" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "local_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dishes" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "cuisine" "cuisine" NOT NULL,
    "description" TEXT,
    "meal_types" "meal_type"[],
    "dish_type" "dish_type" NOT NULL,
    "pairs_with" "dish_type"[],
    "serving_unit" TEXT NOT NULL,
    "prep_minutes" INTEGER NOT NULL DEFAULT 0,
    "cook_minutes" INTEGER NOT NULL DEFAULT 0,
    "batch_cookable" BOOLEAN NOT NULL DEFAULT false,
    "keeps_days" INTEGER,
    "texture" "dish_texture" NOT NULL DEFAULT 'regular',
    "verification_status" "dish_verification" NOT NULL DEFAULT 'draft',
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_ingredients" (
    "id" UUID NOT NULL,
    "dish_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "grams_per_serving" DOUBLE PRECISION NOT NULL,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "preparation" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dish_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL,
    "dish_id" UUID NOT NULL,
    "language" "recipient_language" NOT NULL DEFAULT 'en',
    "steps" TEXT NOT NULL,
    "difficulty" "recipe_difficulty" NOT NULL DEFAULT 'medium',
    "equipment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_tags" (
    "dish_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "dish_tags_pkey" PRIMARY KEY ("dish_id","tag_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_name_key" ON "ingredients"("name");

-- CreateIndex
CREATE INDEX "ingredients_category_idx" ON "ingredients"("category");

-- CreateIndex
CREATE UNIQUE INDEX "nutrient_profiles_ingredient_id_key" ON "nutrient_profiles"("ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "local_units_ingredient_id_name_key" ON "local_units"("ingredient_id", "name");

-- CreateIndex
CREATE INDEX "dishes_verification_status_idx" ON "dishes"("verification_status");

-- CreateIndex
CREATE INDEX "dishes_dish_type_idx" ON "dishes"("dish_type");

-- CreateIndex
CREATE UNIQUE INDEX "dishes_family_id_version_key" ON "dishes"("family_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "dish_ingredients_dish_id_ingredient_id_key" ON "dish_ingredients"("dish_id", "ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_dish_id_language_key" ON "recipes"("dish_id", "language");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- AddForeignKey
ALTER TABLE "nutrient_profiles" ADD CONSTRAINT "nutrient_profiles_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_units" ADD CONSTRAINT "local_units_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_tags" ADD CONSTRAINT "dish_tags_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_tags" ADD CONSTRAINT "dish_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
