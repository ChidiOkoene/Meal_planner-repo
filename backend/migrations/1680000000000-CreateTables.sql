-- backend/migrations/1680000000000-CreateTables.sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  age INTEGER NOT NULL,
  weight FLOAT NOT NULL,
  height FLOAT NOT NULL,
  goal VARCHAR(20) NOT NULL,
  default_cuisine VARCHAR(20) NOT NULL
);

CREATE TABLE dishes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  cuisine VARCHAR(20) NOT NULL,
  nutrition_id INTEGER REFERENCES nutrition_facts(id)
);