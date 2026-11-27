import { type Prisma, type PrismaClient } from '@dyjext/db';

export type RunOnceResult<T> = { skipped: true } | { skipped: false; result: T };

/**
 * Apply a job's database changes at most once, however often the job is retried.
 *
 * The marker row and the job's own changes commit in one transaction. If the job crashes,
 * both roll back and the retry starts clean; if it already committed, the retry is skipped.
 * Concurrent duplicates wait on the marker's unique key, then skip.
 *
 * Side effects outside the database (messages, payments) must carry `key` as their own
 * idempotency key, so the provider ignores a repeat.
 */
export async function runOnce<T>(
  prisma: PrismaClient,
  { key, queue }: { key: string; queue: string },
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<RunOnceResult<T>> {
  return prisma.$transaction(async (tx) => {
    const inserted = await tx.$executeRaw`
      INSERT INTO processed_jobs (key, queue) VALUES (${key}, ${queue})
      ON CONFLICT (key) DO NOTHING`;
    if (inserted === 0) return { skipped: true as const };
    return { skipped: false as const, result: await work(tx) };
  });
}
