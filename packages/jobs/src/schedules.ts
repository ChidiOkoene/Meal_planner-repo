import { type QueueName, QUEUES, type QueueSet } from './queues.js';

export interface Schedule {
  /** Stable id; changing it creates a new schedule. */
  id: string;
  queue: QueueName;
  /** Job name the worker dispatches on. */
  jobName: string;
  /** Cron pattern, interpreted in `timezone`. */
  pattern: string;
  /** IANA timezone. The weekly cycle runs on the recipient market's local time. */
  timezone: string;
}

/**
 * Every recurring job. The weekly cycle (docs/ARCHITECTURE.md §8.2) is added here as each
 * feature lands, e.g. Thursday 09:00 Lagos time for plan generation.
 */
export const SCHEDULES: Schedule[] = [
  {
    id: 'system.heartbeat',
    queue: QUEUES.system,
    jobName: 'system.heartbeat',
    pattern: '* * * * *',
    timezone: 'Africa/Lagos',
  },
];

/**
 * Create or update every schedule, and remove ones no longer listed. Idempotent: run it on
 * every worker start.
 */
export async function syncSchedules(
  queues: QueueSet,
  schedules: Schedule[] = SCHEDULES,
): Promise<void> {
  const wanted = new Map(schedules.map((s) => [s.id, s]));
  for (const schedule of schedules) {
    await queues[schedule.queue].upsertJobScheduler(
      schedule.id,
      { pattern: schedule.pattern, tz: schedule.timezone },
      { name: schedule.jobName, data: {} },
    );
  }
  for (const name of Object.values(QUEUES)) {
    const existing = await queues[name].getJobSchedulers();
    for (const scheduler of existing) {
      const id = scheduler.key;
      if (!wanted.has(id) || wanted.get(id)!.queue !== name) {
        await queues[name].removeJobScheduler(id);
      }
    }
  }
}
