import { fileURLToPath } from 'node:url';
import { createPrismaClient } from '@dyjext/db';
import { config as loadDotenv } from 'dotenv';
import { pino } from 'pino';
import { loadWorkerConfig } from './config.js';
import { startDashboard } from './dashboard.js';
import { startWorker } from './worker.js';

loadDotenv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const logger = pino({
    level: config.LOG_LEVEL,
    ...(config.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }
      : {}),
  });
  const prisma = createPrismaClient({ connectionString: config.DATABASE_URL });
  const worker = await startWorker({
    prisma,
    redisUrl: config.REDIS_URL,
    logger,
    concurrency: config.WORKER_CONCURRENCY,
    outboxPollMs: config.OUTBOX_POLL_MS,
  });

  const dashboard =
    config.QUEUE_DASHBOARD_USER && config.QUEUE_DASHBOARD_PASSWORD
      ? await startDashboard(worker.queues, {
          host: config.QUEUE_DASHBOARD_HOST,
          port: config.QUEUE_DASHBOARD_PORT,
          user: config.QUEUE_DASHBOARD_USER,
          password: config.QUEUE_DASHBOARD_PASSWORD,
        })
      : null;
  if (dashboard) {
    logger.info(
      `Queue dashboard on http://${config.QUEUE_DASHBOARD_HOST}:${config.QUEUE_DASHBOARD_PORT}/queues`,
    );
  }

  // Graceful shutdown: finish running jobs before exiting (platforms send SIGTERM on deploy).
  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'Shutting down');
    await dashboard?.close();
    await worker.stop();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
