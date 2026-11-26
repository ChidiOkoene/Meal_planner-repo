import { type Prisma, type PrismaClient } from '@dyjext/db';
import { type Queue } from 'bullmq';

/** A domain event, as delivered to job handlers. */
export interface OutboxEventJob {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  occurredAt: string;
}

export interface NewOutboxEvent {
  /** What changed, e.g. "recipient". */
  aggregateType: string;
  aggregateId: string;
  /** Past tense, e.g. "recipient.invited", "meal_plan.approved". */
  eventType: string;
  payload: Prisma.InputJsonValue;
}

/**
 * Record a domain event. Call it with the transaction client of the change that caused the
 * event: both commit together or neither does, so an event is never lost or invented.
 */
export function recordEvent(tx: Prisma.TransactionClient, event: NewOutboxEvent) {
  return tx.outboxEvent.create({ data: event });
}

interface OutboxRow {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: unknown;
  occurred_at: Date;
}

/**
 * Move a batch of unprocessed outbox events onto the events queue. Safe to run in parallel
 * (rows are claimed with SKIP LOCKED) and safe to repeat after a crash: each job's id is the
 * event id, and BullMQ never adds a job whose id already exists.
 *
 * @returns the number of events relayed.
 */
export async function relayOutboxBatch(
  prisma: PrismaClient,
  eventsQueue: Queue,
  options: { batchSize?: number } = {},
): Promise<number> {
  const batchSize = options.batchSize ?? 100;
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<OutboxRow[]>`
        SELECT id, aggregate_type, aggregate_id, event_type, payload, occurred_at
        FROM outbox_events
        WHERE processed_at IS NULL
        ORDER BY occurred_at, id
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED`;

      const relayed: string[] = [];
      for (const row of rows) {
        const job: OutboxEventJob = {
          eventId: row.id,
          eventType: row.event_type,
          aggregateType: row.aggregate_type,
          aggregateId: row.aggregate_id,
          payload: row.payload,
          occurredAt: row.occurred_at.toISOString(),
        };
        try {
          await eventsQueue.add(row.event_type, job, { jobId: row.id });
          relayed.push(row.id);
        } catch (error) {
          await tx.outboxEvent.update({
            where: { id: row.id },
            data: {
              attempts: { increment: 1 },
              lastError: (error as Error).message.slice(0, 1000),
            },
          });
        }
      }
      if (relayed.length > 0) {
        await tx.outboxEvent.updateMany({
          where: { id: { in: relayed } },
          data: { processedAt: new Date(), attempts: { increment: 1 } },
        });
      }
      return relayed.length;
    },
    { timeout: 30_000 },
  );
}
