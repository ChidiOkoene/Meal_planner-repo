-- Enums
CREATE TYPE cuisine AS ENUM ('NG', 'GH', 'KE', 'ZA', 'US', 'CM');
CREATE TYPE meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE activity_level AS ENUM ('sedentary', 'light', 'moderate', 'active', 'very_active');
CREATE TYPE dietary_goal AS ENUM ('weight_loss', 'muscle_gain', 'maintenance', 'family', 'athlete');

-- Tables
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age INT NOT NULL CHECK (age > 0),
  weight FLOAT NOT NULL CHECK (weight > 0),
  height FLOAT NOT NULL CHECK (height > 0),
  activity_level activity_level NOT NULL,
  dietary_goal dietary_goal NOT NULL
);

CREATE TABLE dishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  country_code cuisine NOT NULL,
  prep_time INT CHECK (prep_time > 0),
  difficulty difficulty_level NOT NULL,
  image_path TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  standard_unit VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dish_ingredients (
  dish_id UUID REFERENCES dishes(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity FLOAT NOT NULL,
  unit VARCHAR(50) NOT NULL,
  notes TEXT,
  PRIMARY KEY (dish_id, ingredient_id)
);

CREATE TABLE nutrition_facts (
  dish_id UUID PRIMARY KEY REFERENCES dishes(id) ON DELETE CASCADE,
  calories FLOAT NOT NULL CHECK (calories >= 0),
  protein_g FLOAT NOT NULL CHECK (protein_g >= 0),
  carbs_g FLOAT NOT NULL CHECK (carbs_g >= 0),
  fats_g FLOAT NOT NULL CHECK (fats_g >= 0),
  fiber_g FLOAT NOT NULL CHECK (fiber_g >= 0),
  sugar_g FLOAT CHECK (sugar_g >= 0),
  sodium_mg FLOAT CHECK (sodium_mg >= 0),
  vitamins JSONB,
  minerals JSONB
);

CREATE TABLE recipe_guides (
  dish_id UUID PRIMARY KEY REFERENCES dishes(id) ON DELETE CASCADE,
  steps JSONB NOT NULL, -- Array of step objects
  tips TEXT,
  serving_suggestion TEXT,
  llm_model_version VARCHAR(50) NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  country_filter cuisine NOT NULL,
  dietary_goal dietary_goal NOT NULL,
  total_calories FLOAT,
  total_protein FLOAT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date >= start_date)
);

CREATE TABLE meal_plan_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_calories FLOAT,
  total_protein FLOAT
);

CREATE TABLE meal_plan_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID NOT NULL REFERENCES meal_plan_days(id) ON DELETE CASCADE,
  meal_type meal_type NOT NULL,
  dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  portion_size FLOAT NOT NULL DEFAULT 1.0,
  custom_prep_notes TEXT
);

CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  custom_name VARCHAR(255), -- For ingredients not in catalog
  quantity FLOAT NOT NULL,
  unit VARCHAR(50) NOT NULL,
  purchased BOOLEAN DEFAULT false,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (custom_name IS NOT NULL OR ingredient_id IS NOT NULL)
);