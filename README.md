# Dyjext Care

Healthy, familiar home meals for parents living with diabetes or high blood pressure in Africa, paid for by family abroad.

A family member abroad (the **payer**) subscribes for a parent at home (the **recipient**). Each week:

1. A meal plan is built from a verified catalogue of local dishes, within limits set by a dietitian.
2. A dietitian approves the plan, and it is sent to the parent on WhatsApp.
3. A local vendor buys and delivers the ingredients.
4. The payer gets a delivery photo and, each month, a progress report.

The first launch covers Lagos, Nigerian food, type 2 diabetes and hypertension, with payers in the UK.

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

Create the database tables and load test data:

```bash
pnpm db:deploy
```

```bash
pnpm db:seed
```

## Common commands

| Command             | What it does                                                      |
| ------------------- | ----------------------------------------------------------------- |
| `pnpm build`        | Build every package                                               |
| `pnpm lint`         | Lint every package                                                |
| `pnpm typecheck`    | Type-check every package                                          |
| `pnpm test`         | Run tests                                                         |
| `pnpm format`       | Format the repository with Prettier                               |
| `pnpm format:check` | Check formatting without changing files                           |
| `pnpm db:migrate`   | Create a migration after changing the Prisma schema, and apply it |
| `pnpm db:deploy`    | Apply existing migrations                                         |
| `pnpm db:check`     | Fail if the schema and migrations are out of sync                 |
| `pnpm db:seed`      | Load fictional test data (safe to re-run)                         |
| `pnpm db:studio`    | Browse the database in Prisma Studio                              |

## Contributing

Branch names follow `type(scope)/short-title`, and commit messages and PR titles follow `type(scope): title`.

- **type:** `feat`, `fix` or `chore`
- **scope:** `Data`, `UI`, `SW` or `ML`

Example: branch `feat(SW)/planner-engine-v1`, PR title `feat(SW): planner engine v1`.

Every PR runs the CI workflow (formatting, lint, typecheck, tests and build). Repository settings such as branch protection are listed in [`docs/repository-settings.md`](docs/repository-settings.md).
