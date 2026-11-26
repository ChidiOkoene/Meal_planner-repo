import { z } from 'zod';

/** Every environment variable the worker reads, validated once at startup. */
export const workerConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    /** Jobs processed in parallel per queue. */
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
    /** How often the outbox is checked for new events, in milliseconds. */
    OUTBOX_POLL_MS: z.coerce.number().int().min(100).max(60_000).default(1000),
    /** Queue dashboard. Disabled unless both credentials are set. */
    QUEUE_DASHBOARD_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
    QUEUE_DASHBOARD_HOST: z.string().default('127.0.0.1'),
    QUEUE_DASHBOARD_USER: z.string().min(1).optional(),
    QUEUE_DASHBOARD_PASSWORD: z.string().min(12, 'Use at least 12 characters').optional(),
  })
  .refine((c) => Boolean(c.QUEUE_DASHBOARD_USER) === Boolean(c.QUEUE_DASHBOARD_PASSWORD), {
    message: 'Set both QUEUE_DASHBOARD_USER and QUEUE_DASHBOARD_PASSWORD, or neither',
    path: ['QUEUE_DASHBOARD_PASSWORD'],
  });

export type WorkerConfig = z.infer<typeof workerConfigSchema>;

export function loadWorkerConfig(
  env: Record<string, string | undefined> = process.env,
): WorkerConfig {
  const result = workerConfigSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${problems}`);
  }
  return result.data;
}
