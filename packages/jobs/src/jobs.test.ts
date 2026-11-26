import { randomUUID } from 'node:crypto';
import { createPrismaClient, type PrismaClient } from '@dyjext/db';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { runOnce } from './idempotency.js';
import { recordEvent, relayOutboxBatch } from './outbox.js';
import { createQueues, QUEUES, type QueueSet } from './queues.js';
import { syncSchedules } from './schedules.js';

// Needs Postgres (migrated) and Redis. Each run uses its own queue prefix.
const hasServices = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

describe.skipIf(!hasServices)('jobs', () => {
  let prisma: PrismaClient;
  let queues: QueueSet;
  const prefix = `test-${randomUUID().slice(0, 8)}`;
  const aggregateType = `test-${prefix}`;

  beforeAll(() => {
    prisma = createPrismaClient();
    queues = createQueues({ redisUrl: process.env.REDIS_URL!, prefix });
  });

  afterEach(async () => {
    await prisma.outboxEvent.deleteMany({ where: { aggregateType } });
    await prisma.processedJob.deleteMany({ where: { queue: prefix } });
    await prisma.auditLog.deleteMany({ where: { action: `test.${prefix}` } });
  });

  afterAll(async () => {
    for (const name of Object.values(QUEUES)) await queues[name].obliterate({ force: true });
    await queues.close();
    await prisma.$disconnect();
  });

  async function record(count: number) {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < count; i++) {
        await recordEvent(tx, {
          aggregateType,
          aggregateId: randomUUID(),
          eventType: 'test.happened',
          payload: { n: i },
        });
      }
    });
  }

  describe('outbox', () => {
    it('never records an event when the surrounding transaction rolls back', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await recordEvent(tx, {
            aggregateType,
            aggregateId: randomUUID(),
            eventType: 'x',
            payload: {},
          });
          throw new Error('business change failed');
        }),
      ).rejects.toThrow('business change failed');
      expect(await prisma.outboxEvent.count({ where: { aggregateType } })).toBe(0);
    });

    it('relays each event exactly once, even with two relays racing', async () => {
      await record(25);
      const [a, b] = await Promise.all([
        relayOutboxBatch(prisma, queues.events, { batchSize: 10, aggregateTypes: [aggregateType] }),
        relayOutboxBatch(prisma, queues.events, { batchSize: 10, aggregateTypes: [aggregateType] }),
      ]);
      let rest = 0;
      for (let n = -1; n !== 0;) {
        n = await relayOutboxBatch(prisma, queues.events, {
          batchSize: 10,
          aggregateTypes: [aggregateType],
        });
        rest += n;
      }
      expect(a + b + rest).toBe(25);
      expect(await queues.events.count()).toBe(25);
      expect(await prisma.outboxEvent.count({ where: { aggregateType, processedAt: null } })).toBe(
        0,
      );
    });

    it('does not enqueue a duplicate if an event is relayed again after a crash', async () => {
      await record(1);
      const event = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateType } });
      await relayOutboxBatch(prisma, queues.events, { aggregateTypes: [aggregateType] });
      // Simulate a crash between enqueueing and marking the row as processed.
      await prisma.outboxEvent.update({ where: { id: event.id }, data: { processedAt: null } });
      await relayOutboxBatch(prisma, queues.events, { aggregateTypes: [aggregateType] });
      const jobs = await queues.events.getJobs(['waiting', 'delayed', 'active', 'completed']);
      expect(jobs.filter((j) => j.id === event.id)).toHaveLength(1);
    });
  });

  describe('runOnce', () => {
    const effect = (tx: Parameters<Parameters<typeof runOnce>[2]>[0], id: string) =>
      tx.auditLog.create({
        data: { actorType: 'system', action: `test.${prefix}`, entityType: 'job', entityId: id },
      });

    it('applies a job once and skips repeats', async () => {
      const id = randomUUID();
      const first = await runOnce(prisma, { key: `k-${id}`, queue: prefix }, (tx) =>
        effect(tx, id),
      );
      const second = await runOnce(prisma, { key: `k-${id}`, queue: prefix }, (tx) =>
        effect(tx, id),
      );
      expect(first.skipped).toBe(false);
      expect(second.skipped).toBe(true);
      expect(await prisma.auditLog.count({ where: { entityId: id } })).toBe(1);
    });

    it('rolls back a crashed attempt completely, so the retry applies it once', async () => {
      const id = randomUUID();
      await expect(
        runOnce(prisma, { key: `k-${id}`, queue: prefix }, async (tx) => {
          await effect(tx, id);
          throw new Error('crash mid-job');
        }),
      ).rejects.toThrow('crash mid-job');
      expect(await prisma.auditLog.count({ where: { entityId: id } })).toBe(0);

      const retry = await runOnce(prisma, { key: `k-${id}`, queue: prefix }, (tx) =>
        effect(tx, id),
      );
      expect(retry.skipped).toBe(false);
      expect(await prisma.auditLog.count({ where: { entityId: id } })).toBe(1);
    });

    it('lets only one of two concurrent duplicates through', async () => {
      const id = randomUUID();
      const results = await Promise.all([
        runOnce(prisma, { key: `k-${id}`, queue: prefix }, (tx) => effect(tx, id)),
        runOnce(prisma, { key: `k-${id}`, queue: prefix }, (tx) => effect(tx, id)),
      ]);
      expect(results.filter((r) => !r.skipped)).toHaveLength(1);
      expect(await prisma.auditLog.count({ where: { entityId: id } })).toBe(1);
    });
  });

  describe('schedules', () => {
    it('creates schedules idempotently and removes ones no longer listed', async () => {
      const schedules = [
        {
          id: 'test.every-minute',
          queue: QUEUES.system,
          jobName: 'test.tick',
          pattern: '* * * * *',
          timezone: 'Africa/Lagos',
        },
      ];
      await syncSchedules(queues, schedules);
      await syncSchedules(queues, schedules);
      const created = await queues.system.getJobSchedulers();
      expect(created.map((s) => [s.key, s.pattern, s.tz])).toEqual([
        ['test.every-minute', '* * * * *', 'Africa/Lagos'],
      ]);

      await syncSchedules(queues, []);
      expect(await queues.system.getJobSchedulers()).toEqual([]);
    });
  });
});
