import { type PrismaClient } from '@dyjext/db';
import {
  createQueues,
  type OutboxEventJob,
  QUEUES,
  type QueueSet,
  redisConnection,
  relayOutboxBatch,
  syncSchedules,
  type Schedule,
  SCHEDULES,
} from '@dyjext/jobs';
import { type Job, Worker, type WorkerOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { type Logger } from 'pino';
import { eventHandlers, type HandlerContext, type JobHandler, systemHandlers } from './handlers.js';

export interface StartWorkerOptions {
  prisma: PrismaClient;
  redisUrl: string;
  logger: Logger;
  concurrency?: number;
  outboxPollMs?: number;
  /** Queue key prefix (tests). */
  prefix?: string;
  /** Relay only outbox events of these aggregate types (tests sharing a database). */
  outboxAggregateTypes?: string[];
  schedules?: Schedule[];
  /** Override handlers (tests). */
  systemHandlers?: Record<string, JobHandler>;
  eventHandlers?: typeof eventHandlers;
  /** Extra BullMQ worker settings (tests shorten lock and stall timings). */
  workerOptions?: Partial<WorkerOptions>;
}

export interface RunningWorker {
  queues: QueueSet;
  /** Stop taking new jobs, let running ones finish, then close every connection. */
  stop(): Promise<void>;
}

export async function startWorker(options: StartWorkerOptions): Promise<RunningWorker> {
  const { prisma, logger } = options;
  const queues = createQueues({ redisUrl: options.redisUrl, prefix: options.prefix });
  const redis = new Redis(options.redisUrl, { maxRetriesPerRequest: 3 });
  const context: HandlerContext = { prisma, redis, logger };
  const system = options.systemHandlers ?? systemHandlers;
  const events = options.eventHandlers ?? eventHandlers;

  await syncSchedules(queues, options.schedules ?? SCHEDULES);

  const common = {
    connection: redisConnection(options.redisUrl),
    prefix: options.prefix,
    concurrency: options.concurrency ?? 5,
    ...options.workerOptions,
  };

  const processors: Record<string, (job: Job) => Promise<unknown>> = {
    [QUEUES.system]: async (job) => {
      const handler = system[job.name];
      if (!handler) throw new Error(`No handler for system job "${job.name}"`);
      return handler(job, context);
    },
    [QUEUES.events]: async (job) => {
      const event = job.data as OutboxEventJob;
      const handler = events[event.eventType];
      if (!handler) {
        logger.debug(
          { eventType: event.eventType, eventId: event.eventId },
          'No handler for event',
        );
        return null;
      }
      return handler(event, context);
    },
  };

  const workers = Object.entries(processors).map(([queueName, processor]) => {
    const worker = new Worker(queueName, processor, common);
    worker.on('failed', (job, error) => {
      if (!job) return;
      const attempts = job.opts.attempts ?? 1;
      const final = job.attemptsMade >= attempts;
      logger.warn(
        {
          queue: queueName,
          jobId: job.id,
          name: job.name,
          attempt: job.attemptsMade,
          final,
          err: error,
        },
        final
          ? 'Job failed for the last time; moved to dead-letter queue'
          : 'Job failed; will retry',
      );
      if (final) {
        void queues[QUEUES.deadLetter]
          .add(
            job.name,
            {
              queue: queueName,
              jobId: job.id,
              data: job.data as unknown,
              error: error.message,
              failedAt: new Date().toISOString(),
            },
            // BullMQ rejects ":" in custom job ids.
            { jobId: `${queueName}.${job.id}`, attempts: 1, removeOnComplete: false },
          )
          .catch((dlqError: unknown) =>
            logger.error({ err: dlqError }, 'Could not record dead letter'),
          );
      }
    });
    worker.on('error', (error) => logger.error({ queue: queueName, err: error }, 'Worker error'));
    return worker;
  });

  // Outbox relay loop: moves committed domain events onto the events queue.
  let running = true;
  const relay = (async () => {
    while (running) {
      try {
        const relayed = await relayOutboxBatch(prisma, queues[QUEUES.events], {
          aggregateTypes: options.outboxAggregateTypes,
        });
        if (relayed > 0) logger.debug({ relayed }, 'Relayed outbox events');
        if (relayed > 0) continue; // more may be waiting
      } catch (error) {
        logger.error({ err: error }, 'Outbox relay failed; will retry');
      }
      await new Promise((resolve) => setTimeout(resolve, options.outboxPollMs ?? 1000));
    }
  })();

  logger.info({ queues: Object.keys(processors) }, 'Worker started');

  return {
    queues,
    async stop() {
      running = false;
      await relay;
      await Promise.all(workers.map((w) => w.close()));
      await queues.close();
      await redis.quit();
      logger.info('Worker stopped');
    },
  };
}
