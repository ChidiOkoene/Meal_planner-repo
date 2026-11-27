# @dyjext/jobs

Job queues, the transactional outbox and idempotency helpers, shared by the API and the worker.

## Recording a domain event (API)

```ts
await prisma.$transaction(async (tx) => {
  const recipient = await tx.recipient.update({ where: { id }, data: { status: 'consented' } });
  await recordEvent(tx, {
    aggregateType: 'recipient',
    aggregateId: recipient.id,
    eventType: 'recipient.consented',
    payload: { recipientId: recipient.id },
  });
});
```

The event commits with the change or not at all. The worker relays it to the `events` queue.

## Applying a job's effects once (worker)

```ts
await runOnce(prisma, { key: `send-plan:${planId}`, queue: 'events' }, async (tx) => {
  // database changes here commit together with the "processed" marker
});
```

## What's here

| Export                                          | Purpose                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `QUEUES`, `createQueues`, `DEFAULT_JOB_OPTIONS` | Queue names and shared retry/retention settings                       |
| `recordEvent`, `relayOutboxBatch`               | Transactional outbox: write with the change, relay safely in parallel |
| `runOnce`                                       | Exactly-once database effects for retried jobs                        |
| `SCHEDULES`, `syncSchedules`                    | Recurring jobs with cron patterns in a given timezone                 |
