# @dyjext/api

NestJS (Fastify) HTTP API for the web app, the staff console and webhooks. See `docs/ARCHITECTURE.md` §6 and §13.

## Run locally

From the repository root, with Postgres and Redis running (`docker compose up -d`) and `.env` in place:

```bash
pnpm --filter @dyjext/api dev
```

This compiles with `tsc --watch` and restarts on change. The API listens on `http://localhost:4000`.

| URL                  | What                                               |
| -------------------- | -------------------------------------------------- |
| `/healthz`           | Liveness: the process is running                   |
| `/readyz`            | Readiness: database and Redis respond (503 if not) |
| `/v1/meta`           | Service name, version and environment              |
| `/docs`              | OpenAPI explorer (not served in production)        |
| `/docs/openapi.json` | OpenAPI document, used to generate the web client  |

## Conventions

- **Routes** live under `/v1`, except the health probes.
- **Validation:** request parts are validated with zod schemas from `@dyjext/shared`:
  `@Body(new ZodValidationPipe(schema))`. Document them with `@ApiZodBody(schema)` / `@ApiZodQuery(schema)`.
- **Errors** always have the shape `{ error: { code, message, details?, requestId } }`. Unexpected errors are logged with a stack trace; clients see only a generic message.
- **Dependency injection:** always inject with an explicit token, `@Inject(Thing) thing: Thing`. Tests run without TypeScript's decorator metadata, so implicit injection would fail there.
- **Configuration:** every environment variable is declared and validated in `src/config/config.ts`. The API refuses to start if one is missing or invalid.
- **Logging:** pino JSON logs with a request id (taken from `x-request-id` when valid, and returned in the same header). Authorization headers and cookies are redacted.
- **Rate limiting:** per client IP, `RATE_LIMIT_PER_MINUTE` (default 120). Health probes are exempt.

## Tests

```bash
pnpm --filter @dyjext/api test
```

Tests build the full app and call it in memory with `app.inject()`. They need Postgres and Redis, and are skipped when `DATABASE_URL` or `REDIS_URL` is not set.
