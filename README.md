# Dyjext Care

Healthy, familiar home meals for people living with diabetes or high blood pressure in Africa, paid for by family anywhere, or by themselves.

A **payer** subscribes for a **recipient**: usually a parent, sometimes another relative, or the payer themself. Payers can live anywhere, in Nigeria or abroad. Each week:

1. A meal plan is built from a verified catalogue of local dishes, within limits set by a dietitian.
2. A dietitian approves the plan, and it is sent to the recipient on WhatsApp.
3. **Full care** (in delivery areas): a local vendor buys and delivers the ingredients, and the payer gets a delivery photo. **Plan only** (anywhere else): the recipient gets a shopping list and buys their own food.
4. Each month, the payer gets a progress report.

The first launch covers Lagos for delivery, Nigerian food, type 2 diabetes and hypertension, with payment in naira or pounds. See [ADR 010](docs/adr/010-payers-anywhere-and-self-subscribers.md).

The full design is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Work is tracked as GitHub issues, one per planned PR.

## Repository layout

```
apps/
  web/        Next.js: public site, payer app, staff console, vendor order pages
  api/        NestJS HTTP API and webhooks
  worker/     Background jobs and the weekly-cycle scheduler
packages/
  config/     Shared TypeScript and ESLint presets
  db/         Prisma schema, migrations, seed and catalogue importers
  shared/     Shared zod schemas, types and money helpers
  planner/    Meal-planning engine (pure functions, no I/O)
  nutrition/  Nutrient maths and local unit conversion
  messaging/  WhatsApp templates and message builders
docs/         Architecture and decision records
```

Most apps and packages are placeholders at this stage; each README names the issue that builds it.

## Getting started

Requirements: Node.js 22 (see `.nvmrc`), pnpm 10 (`corepack enable`), Docker.

Install dependencies:

```bash
pnpm install
```

Start PostgreSQL and Redis:

```bash
docker compose up -d
```

Create your local environment file:

```bash
cp .env.example .env
```

## Common commands

| Command             | What it does                            |
| ------------------- | --------------------------------------- |
| `pnpm build`        | Build every package                     |
| `pnpm lint`         | Lint every package                      |
| `pnpm typecheck`    | Type-check every package                |
| `pnpm test`         | Run tests                               |
| `pnpm format`       | Format the repository with Prettier     |
| `pnpm format:check` | Check formatting without changing files |

## Contributing

Branch names follow `type(scope)/short-title`, and commit messages and PR titles follow `type(scope): title`.

- **type:** `feat`, `fix` or `chore`
- **scope:** `Data`, `UI`, `SW` or `ML`

Example: branch `feat(SW)/planner-engine-v1`, PR title `feat(SW): planner engine v1`.
