import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { Controller, Get, Module, Param } from '@nestjs/common';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { LOG_REDACT_PATHS } from '@dyjext/shared';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.factory.js';
import { loadConfig } from '../config/config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Audited } from './audited.decorator.js';

@Controller('test-audited')
class AuditedController {
  @Get(':id')
  @Audited({ action: 'test.viewed', entityType: 'test_record' })
  view(@Param('id') id: string) {
    return { id, secret: 'health details' };
  }
}

@Module({ controllers: [AuditedController] })
class AuditedModule {}

describe('log redaction', () => {
  it('removes phone numbers and health details from log lines', () => {
    const lines: string[] = [];
    const logger = pino(
      { redact: { paths: LOG_REDACT_PATHS, censor: '[redacted]' } },
      new Writable({ write: (chunk: Buffer, _e, done) => (lines.push(chunk.toString()), done()) }),
    );
    logger.info({
      recipient: { phoneE164: '+2348012345678', displayName: 'Mama' },
      healthProfile: { conditions: ['t2_diabetes'] },
      req: { headers: { authorization: 'Bearer abc' } },
    });
    const line = lines.join('');
    expect(line).not.toContain('+2348012345678');
    expect(line).not.toContain('t2_diabetes');
    expect(line).not.toContain('Bearer abc');
    expect(line).toContain('Mama');
  });
});

const hasServices = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

describe.skipIf(!hasServices)('audit log', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp(loadConfig({ ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'silent' }), {
      extraModules: [AuditedModule],
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  it('records who viewed what, with the request id', async () => {
    const id = randomUUID();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/test-audited/${id}`,
      headers: { 'x-request-id': `req-${id}` },
    });
    expect(res.statusCode).toBe(200);
    const entries = await prisma.auditLog.findMany({ where: { entityId: id } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: 'test.viewed',
      entityType: 'test_record',
      actorType: 'user',
      requestId: `req-${id}`,
    });
  });

  it('fails closed: no audit entry, no response body', async () => {
    // entity_id is a uuid column, so this id makes the audit insert fail.
    const res = await app.inject({ method: 'GET', url: '/v1/test-audited/not-a-uuid' });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('health details');
  });

  it('cannot be altered or deleted afterwards', async () => {
    const id = randomUUID();
    await app.inject({ method: 'GET', url: `/v1/test-audited/${id}` });
    await expect(
      prisma.auditLog.updateMany({ where: { entityId: id }, data: { action: 'tampered' } }),
    ).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.deleteMany({ where: { entityId: id } })).rejects.toThrow(
      /append-only/,
    );
    await expect(prisma.$executeRawUnsafe('TRUNCATE audit_log')).rejects.toThrow(/append-only/);
    expect(await prisma.auditLog.count({ where: { entityId: id, action: 'test.viewed' } })).toBe(1);
  });

  it('allows only purges of rows older than two years', async () => {
    const id = randomUUID();
    await app.inject({ method: 'GET', url: `/v1/test-audited/${id}` });
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.audit_purge', 'on', true)`;
        await tx.auditLog.deleteMany({ where: { entityId: id } });
      }),
    ).rejects.toThrow(/older than two years/);
  });
});
