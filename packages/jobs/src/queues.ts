import { type DefaultJobOptions, Queue, type QueueOptions } from 'bullmq';

/** Every queue in the system. Add one here when a module needs its own. */
export const QUEUES = {
  /** Domain events relayed from the outbox, one job per event; job name = event type. */
  events: 'events',
  /** Scheduled housekeeping and the weekly cycle (plans, orders, payouts). */
  system: 'system',
  /** Jobs that failed every attempt, kept for a person to inspect and replay. */
  deadLetter: 'dead-letter',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/**
 * Retry with exponential backoff (5 s, 10 s, 20 s, 40 s). Completed jobs are kept for 7 days:
 * their ids are what stop the outbox relay from enqueuing the same event twice.
 */
export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 50_000 },
  removeOnFail: { age: 30 * 24 * 3600 },
};

/** BullMQ connection options for a Redis URL. Workers need `maxRetriesPerRequest: null`. */
export function redisConnection(url: string): QueueOptions['connection'] {
  return { url, maxRetriesPerRequest: null };
}

export interface QueueSetOptions {
  redisUrl: string;
  /** Key prefix; tests use a unique one so they never touch real queues. */
  prefix?: string;
}

export type QueueSet = Record<QueueName, Queue> & { close(): Promise<void> };

/** Open every queue with the shared defaults. */
export function createQueues({ redisUrl, prefix }: QueueSetOptions): QueueSet {
  const queues = Object.fromEntries(
    Object.values(QUEUES).map((name) => [
      name,
      new Queue(name, {
        connection: redisConnection(redisUrl),
        prefix,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
    ]),
  ) as Record<QueueName, Queue>;
  return Object.assign(queues, {
    async close() {
      await Promise.all(Object.values(QUEUES).map((name) => queues[name].close()));
    },
  });
}
