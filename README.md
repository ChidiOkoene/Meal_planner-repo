# Modern Meal Planner

AI-driven meal planning for 6 cuisines (Nigeria, Cameroon, Ghana, Kenya, South Africa, USA) with nutrition tracking, recipe guides, and shopping lists.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS + Redux Toolkit
- **Backend**: Node.js/Express + PostgreSQL + TypeORM
- **LLM Service**: Python/FastAPI + HuggingFace Transformers (LLaMA)
- **Infra**: Docker, Kubernetes, PostgreSQL, Redis, DigitalOcean Spaces
- **CI/CD**: GitHub Actions, Terraform, Helm

## Setup
```bash
# Clone repo
git clone https://github.com/your-username/meal-planner.git
cd meal-planner

# Install dependencies
./scripts/bootstrap.sh

# Start services
docker-compose up