import { type PrismaClient } from '@dyjext/db';
import { type OutboxEventJob } from '@dyjext/jobs';
import { type Job } from 'bullmq';
import { type Logger } from 'pino';
import { type Redis } from 'ioredis';

export interface HandlerContext {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

export type JobHandler = (job: Job, context: HandlerContext) => Promise<unknown>;

/**
 * Handlers for scheduled and system jobs, by job name. Feature modules add theirs here,
 * e.g. 'planning.generateDrafts' (Thursday 09:00 Lagos time).
 */
export const systemHandlers: Record<string, JobHandler> = {
  /** Proves the scheduler and worker are alive; /readyz-style checks can read the key. */
  'system.heartbeat': async (_job, { redis }) => {
    await redis.set('worker:heartbeat', new Date().toISOString(), 'EX', 300);
  },
};

/**
 * Handlers for domain events relayed from the outbox, by event type. An event with no
 * handler completes without doing anything, so modules can publish events before anyone
 * consumes them.
 */
export const eventHandlers: Record<
  string,
  (event: OutboxEventJob, context: HandlerContext) => Promise<unknown>
> = {};
