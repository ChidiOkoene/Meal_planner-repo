<<<<<<< HEAD
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
=======
**Folder Structure**

```
.
├── frontend/           # React + TypeScript application
├── backend/            # REST/GraphQL API service
├── llm-service/        # AI microservice wrapping the LLM
├── infra/              # Terraform/Helm/Kubernetes manifests
├── docs/               # Project documentation and prompts
├── scripts/            # Automation scripts (bootstrap, deploy)
├── tests/              # Integration & end-to-end tests
├── .gitignore          # Git ignore patterns
└── README.md           # Top‑level project overview
```

---

# Dyjext Meal Planner

## Project Vision

Dyjext is an open‑source, AI‑driven meal‑planning web application supporting diverse cuisines (Nigeria, Cameroon, Ghana, Kenya, South Africa, USA). Users receive personalised weekly meal plans, nutritional breakdowns, step-by-step recipe guides, calendar scheduling, exportable shopping lists, and seamless sharing capabilities.

## Tech Stack

* **Frontend:** React, TypeScript, Tailwind CSS, FullCalendar, Recharts
* **Backend:** Node.js (Express/GraphQL) or Python (FastAPI), Prisma or TypeORM/SQLAlchemy
* **Database:** PostgreSQL
* **AI Service:** FastAPI (or Express) + 🤗 Transformers (GPT‑NeoX/LLaMA)
* **Caching:** Redis
* **Storage:** S3‑compatible (e.g., DigitalOcean Spaces)
* **Infra & CD/CI:** Docker, Kubernetes, Terraform/Helm, GitHub Actions
* **Monitoring:** Prometheus, Grafana; Error tracking: Sentry

## Folder Layout

* `frontend/` – Bootstrapped React app with theming, global state, components
* `backend/` – API routes, ORM models, migrations, unit/integration tests
* `llm-service/` – Dockerized microservice for meal‑plan and recipe generation
* `infra/` – IaC for k8s cluster, DB, cache, storage; Helm charts or Terraform modules
* `docs/` – `chronology.md`, `prompts.md`, additional guides and wireframes
* `scripts/` – `bootstrap.sh`, `deploy.sh`, Makefile for common targets
* `tests/` – End‑to‑end, API integration, nutrient calculator tests

## Prerequisites

* Git ≥2.30
* Docker & Docker Compose
* Node.js ≥16 & npm (or Yarn)
* Python ≥3.9 & Poetry (if using FastAPI)
* Terraform or Helm CLI

## Setup Instructions

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/dyjext-meal-planner.git
   cd dyjext-meal-planner
   ```
2. **Bootstrap all services**

   ```bash
   scripts/bootstrap.sh
   ```
3. **Start development environment**

   ```bash
   make up
   ```
4. **Run tests**

   ```bash
   make test
   ```
5. **Deploy to Kubernetes**

   ```bash
   scripts/deploy.sh
   ```

---

>>>>>>> 0a016369a6f7d294cae76c0a7fdb236d10370851
