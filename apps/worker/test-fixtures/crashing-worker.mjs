// Test fixture: a worker process that takes one job and hangs, so the test can kill it
// with SIGKILL mid-job, exactly like a server dying.
// Usage: node crashing-worker.mjs <redisUrl> <prefix> <queue>
import { Worker } from 'bullmq';

const [redisUrl, prefix, queue] = process.argv.slice(2);
new Worker(
  queue,
  async () => {
    process.stdout.write('started\n');
    await new Promise(() => {});
  },
  {
    connection: { url: redisUrl, maxRetriesPerRequest: null },
    prefix,
    lockDuration: 1000,
    lockRenewTime: 100_000,
    // Same as the test's recovering worker: the stalled check is rate-limited by a key shared
    // across workers, so a longer interval here would delay recovery by up to 30 s.
    stalledInterval: 500,
  },
);
process.stdout.write('ready\n');
