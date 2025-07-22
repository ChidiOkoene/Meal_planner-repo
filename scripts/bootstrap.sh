#!/bin/bash

# Frontend setup
cd frontend
yarn install
yarn add tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Backend setup
cd ../backend
yarn init -y
yarn add express typeorm pg reflect-metadata

# LLM Service setup
cd ../llm-service
python -m venv .venv
source .venv/bin/activate
pip install poetry
poetry init -n
poetry add fastapi uvicorn transformers torch