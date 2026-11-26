import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { type AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { createPrismaClient, type PrismaClient } from '@dyjext/db';
import { createQueues, type OutboxEventJob, QUEUES, recordEvent, runOnce } from '@dyjext/jobs';
import { Redis } from 'ioredis';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadWorkerConfig } from './config.js';
import { startDashboard } from './dashboard.js';
import { startWorker } from './worker.js';

describe('loadWorkerConfig', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost/db',
    REDIS_URL: 'redis://localhost:6379',
  };

  it('applies defaults', () => {
    expect(loadWorkerConfig(base)).toMatchObject({ WORKER_CONCURRENCY: 5, OUTBOX_POLL_MS: 1000 });
  });

  it('requires both dashboard credentials or neither', () => {
    expect(() => loadWorkerConfig({ ...base, QUEUE_DASHBOARD_USER: 'ops' })).toThrow(/both/);
  });
});

const hasServices = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);
const redisUrl = process.env.REDIS_URL ?? '';
const logger = pino({ level: 'silent' });

/** Wait until `check` returns true, or fail after `timeoutMs`. */
async function eventually(check: () => Promise<boolean>, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Condition not met in time');
}

describe.skipIf(!hasServices)('worker', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  const prefix = `test-${randomUUID().slice(0, 8)}`;
  // Test effect rows: outbox rows already marked processed, so the relay never picks them up.
  // (audit_log can't be used: it is append-only.)
  const effectType = `effect-${prefix}`;

  beforeAll(() => {
    prisma = createPrismaClient();
    redis = new Redis(redisUrl);
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { aggregateType: { in: [prefix, effectType] } } });
    await prisma.processedJob.deleteMany({ where: { queue: prefix } });
    const keys = await redis.keys(`${prefix}:*`);
    if (keys.length > 0) await redis.del(...keys);
    await redis.quit();
    await prisma.$disconnect();
  });

  /** The test effect: one row per job, applied through runOnce. */
  const applyEffect = (key: string) =>
    runOnce(prisma, { key, queue: prefix }, (tx) =>
      tx.outboxEvent.create({
        data: {
          aggregateType: effectType,
          aggregateId: randomUUID(),
          eventType: key,
          payload: {},
          processedAt: new Date(),
        },
      }),
    );
  const effectCount = (key: string) =>
    prisma.outboxEvent.count({ where: { aggregateType: effectType, eventType: key } });

  it('delivers a committed domain event to its handler exactly once', async () => {
    const seen: string[] = [];
    const worker = await startWorker({
      prisma,
      redisUrl,
      logger,
      prefix,
      outboxAggregateTypes: [prefix],
      schedules: [],
      outboxPollMs: 100,
      eventHandlers: {
        'test.created': async (event: OutboxEventJob) => {
          seen.push(event.eventId);
          await applyEffect(`event:${event.eventId}`);
        },
      },
    });
    try {
      const event = await prisma.$transaction((tx) =>
        recordEvent(tx, {
          aggregateType: prefix,
          aggregateId: randomUUID(),
          eventType: 'test.created',
          payload: {},
        }),
      );
      await eventually(async () => (await effectCount(`event:${event.id}`)) === 1);
      // Give any duplicate a chance to show up.
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(seen).toEqual([event.id]);
      expect(await effectCount(`event:${event.id}`)).toBe(1);
    } finally {
      await worker.stop();
    }
  });

  it('finishes a job exactly once after the worker running it is killed', async () => {
    const key = `crash:${randomUUID()}`;
    const timings = { lockDuration: 1000, stalledInterval: 500 };
    // Own queue prefix: the stalled check is rate-limited per queue by a key that workers in
    // earlier tests (with the default 30 s interval) would otherwise have set.
    const crashPrefix = `${prefix}-crash`;

    // Worker A runs in its own process, takes the job, and is killed with SIGKILL mid-job.
    const fixture = fileURLToPath(new URL('../test-fixtures/crashing-worker.mjs', import.meta.url));
    const child = spawn(process.execPath, [fixture, redisUrl, crashPrefix, QUEUES.system], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const output = (text: string) =>
      new Promise<void>((resolve) =>
        child.stdout.on('data', (chunk: Buffer) => chunk.toString().includes(text) && resolve()),
      );
    await output('ready');
    const queues = createQueues({ redisUrl, prefix: crashPrefix });
    await queues.system.add('test.crashy', { key });
    await output('started');
    child.kill('SIGKILL');

    // Worker B starts, notices the stalled job once A's lock expires, and runs it.
    const runs: string[] = [];
    const worker = await startWorker({
      prisma,
      redisUrl,
      logger,
      prefix: crashPrefix,
      outboxAggregateTypes: [prefix],
      schedules: [],
      workerOptions: timings,
      systemHandlers: {
        'test.crashy': async (job) => {
          runs.push(String(job.id));
          return applyEffect((job.data as { key: string }).key);
        },
      },
    });
    try {
      await eventually(async () => (await effectCount(key)) === 1, 15_000);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(await effectCount(key)).toBe(1);
      expect(runs).toHaveLength(1);
    } finally {
      await worker.stop();
      for (const name of Object.values(QUEUES)) await queues[name].obliterate({ force: true });
      await queues.close();
    }
  }, 30_000);

  it('moves a job that fails every attempt to the dead-letter queue', async () => {
    const worker = await startWorker({
      prisma,
      redisUrl,
      logger,
      prefix,
      outboxAggregateTypes: [prefix],
      schedules: [],
      systemHandlers: {
        'test.broken': () => Promise.reject(new Error('always fails')),
      },
    });
    try {
      const job = await worker.queues.system.add(
        'test.broken',
        {},
        { attempts: 2, backoff: { type: 'fixed', delay: 50 } },
      );
      await eventually(
        async () =>
          (await worker.queues[QUEUES.deadLetter].getJob(`system.${job.id}`)) !== undefined,
      );
      const dead = await worker.queues[QUEUES.deadLetter].getJob(`system.${job.id}`);
      expect(dead?.data).toMatchObject({ queue: 'system', error: 'always fails' });
    } finally {
      await worker.stop();
    }
  }, 20_000);

  it('runs the heartbeat job', async () => {
    const worker = await startWorker({
      prisma,
      redisUrl,
      logger,
      prefix,
      outboxAggregateTypes: [prefix],
      schedules: [],
    });
    try {
      await redis.del('worker:heartbeat');
      await worker.queues.system.add('system.heartbeat', {});
      await eventually(async () => (await redis.get('worker:heartbeat')) !== null);
    } finally {
      await worker.stop();
    }
  });

  it('protects the queue dashboard with a password', async () => {
    const queues = createQueues({ redisUrl, prefix });
    const dashboard = await startDashboard(queues, {
      host: '127.0.0.1',
      port: 0,
      user: 'ops',
      password: 'correct horse battery',
    });
    try {
      const { port } = dashboard.server.address() as AddressInfo;
      const url = `http://127.0.0.1:${port}/queues`;
      expect((await fetch(url)).status).toBe(401);
      const wrong = Buffer.from('ops:wrong').toString('base64');
      expect((await fetch(url, { headers: { authorization: `Basic ${wrong}` } })).status).toBe(401);
      const right = Buffer.from('ops:correct horse battery').toString('base64');
      expect((await fetch(url, { headers: { authorization: `Basic ${right}` } })).status).toBe(200);
    } finally {
      await dashboard.close();
      await queues.close();
    }
  });
});
