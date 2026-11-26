# @dyjext/worker

Runs background jobs: domain events from the outbox, and scheduled jobs (the weekly cycle). See `docs/ARCHITECTURE.md` §6 and §8.2.

## Run locally

`pnpm dev` at the repository root starts it with the API and web app. To run it alone:

```bash
pnpm --filter @dyjext/worker dev
```

## How it works

- **Outbox relay.** The API records each domain event in the `outbox_events` table in the same transaction as the change that caused it. The worker polls the table and puts each event on the `events` queue, using the event id as the job id, so an event is never queued twice.
- **Handlers.** `src/handlers.ts` maps job names (scheduled jobs) and event types (domain events) to functions. An event with no handler completes without doing anything.
- **Exactly-once effects.** Jobs can be retried after a crash. Handlers wrap their database changes in `runOnce(prisma, { key, queue }, tx => …)` from `@dyjext/jobs`, which commits a marker with the changes, so a retry never applies them twice. Calls to outside services must pass the same key as their own idempotency key.
- **Retries and dead letters.** Five attempts with exponential backoff (5 s to 40 s). A job that fails every attempt is copied to the `dead-letter` queue for a person to inspect and retry.
- **Schedules** are listed in `packages/jobs/src/schedules.ts` with a cron pattern and a timezone (the weekly cycle runs on Lagos time). They are synced on every start; schedules removed from the list are deleted.
- **Graceful shutdown.** On SIGTERM or SIGINT the worker stops taking jobs, lets running ones finish, then exits.

## Queue dashboard

Set `QUEUE_DASHBOARD_USER` and `QUEUE_DASHBOARD_PASSWORD` (at least 12 characters) to serve Bull Board at `http://127.0.0.1:4100/queues`, behind HTTP basic auth. It binds to localhost by default; it moves behind staff sign-in with issue #8.

## Settings

All settings are validated at startup (`src/config.ts`): `DATABASE_URL`, `REDIS_URL`, `WORKER_CONCURRENCY` (default 5), `OUTBOX_POLL_MS` (default 1000), and the dashboard settings above.

## Tests

Tests run the real worker against Postgres and Redis, each with its own queue prefix. One starts a worker in a separate process and kills it mid-job with SIGKILL, then checks a second worker finishes the job exactly once. When changing stall timings, every worker must use the same `stalledInterval`: the stalled check is rate-limited by a key shared across workers.
