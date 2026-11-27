import { Body, Controller, Module, Post } from '@nestjs/common';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from './app.factory.js';
import { ZodValidationPipe } from './common/zod-validation.pipe.js';
import { loadConfig } from './config/config.js';

const echoSchema = z.object({ name: z.string().min(1), servings: z.number().int().positive() });

@Controller('test-echo')
class EchoController {
  @Post()
  echo(@Body(new ZodValidationPipe(echoSchema)) body: z.infer<typeof echoSchema>) {
    return body;
  }
}

@Module({ controllers: [EchoController] })
class EchoModule {}

// Needs the local Postgres and Redis (docker compose up, or the CI service containers).
const hasServices = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

describe.skipIf(!hasServices)('API', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const config = loadConfig({
      ...process.env,
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      RATE_LIMIT_PER_MINUTE: '1000',
    });
    app = await createApp(config, { extraModules: [EchoModule] });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(() => app.close());

  it('reports liveness without the version prefix', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('reports readiness of the database and Redis', async () => {
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.json()).toEqual({ status: 'ok', checks: { database: 'up', redis: 'up' } });
  });

  it('serves versioned routes under /v1', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/meta' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ service: 'dyjext-api', environment: 'test' });
  });

  it('returns 400 with field errors for an invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/test-echo',
      payload: { name: '', servings: 1.5 },
    });
    expect(res.statusCode).toBe(400);
    const { error } = res.json<{ error: { code: string; details: { path: string }[] } }>();
    expect(error.code).toBe('validation_failed');
    expect(error.details.map((d) => d.path).sort()).toEqual(['name', 'servings']);
  });

  it('passes a valid body through', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/test-echo',
      payload: { name: 'Jollof rice', servings: 2 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ name: 'Jollof rice', servings: 2 });
  });

  it('uses the standard error shape for unknown routes and malformed JSON', async () => {
    const missing = await app.inject({ method: 'GET', url: '/v1/does-not-exist' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: { code: 'not_found' } });

    const malformed = await app.inject({
      method: 'POST',
      url: '/v1/test-echo',
      headers: { 'content-type': 'application/json' },
      payload: '{not json',
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toMatchObject({ error: { code: 'bad_request' } });
  });

  it('echoes a valid incoming request id and generates one otherwise', async () => {
    const reused = await app.inject({
      method: 'GET',
      url: '/v1/nope',
      headers: { 'x-request-id': 'lb-abc-123' },
    });
    expect(reused.headers['x-request-id']).toBe('lb-abc-123');
    expect(reused.json()).toMatchObject({ error: { requestId: 'lb-abc-123' } });

    const generated = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { 'x-request-id': 'bad id with spaces' },
    });
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('serves the OpenAPI document outside production', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/openapi.json' });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ paths: Record<string, unknown> }>().paths).toHaveProperty('/v1/meta');
  });
});

describe.skipIf(!hasServices)('rate limiting', () => {
  it('returns 429 after the per-minute limit, but never limits health checks', async () => {
    const config = loadConfig({
      ...process.env,
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      RATE_LIMIT_PER_MINUTE: '2',
    });
    const app = await createApp(config);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    try {
      const codes: number[] = [];
      for (let i = 0; i < 3; i++) {
        codes.push((await app.inject({ method: 'GET', url: '/v1/meta' })).statusCode);
      }
      expect(codes).toEqual([200, 200, 429]);

      const health = await app.inject({ method: 'GET', url: '/healthz' });
      expect(health.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
