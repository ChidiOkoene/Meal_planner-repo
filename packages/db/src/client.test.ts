import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from './client.js';
import { type PrismaClient } from './generated/prisma/client.js';

// Integration tests: run only when a migrated and seeded database is available
// (CI provides one; locally run `pnpm db:migrate && pnpm db:seed` first).
describe.skipIf(!process.env.DATABASE_URL)('database', () => {
  // Created in beforeAll, not at collection time: vitest still runs this describe body when
  // the suite is skipped, and creating a client without DATABASE_URL throws.
  let prisma: PrismaClient;
  beforeAll(() => {
    prisma = createPrismaClient();
  });
  afterAll(() => prisma.$disconnect());

  it('reads seeded staff with their roles', async () => {
    const dietitian = await prisma.user.findUnique({
      where: { email: 'dietitian@example.test' },
      include: { staffRoles: true },
    });
    expect(dietitian?.staffRoles.map((r) => r.role)).toEqual(['dietitian']);
  });

  it('generates UUIDv7 primary keys', async () => {
    const event = await prisma.outboxEvent.create({
      data: {
        aggregateType: 'test',
        aggregateId: '00000000-0000-7000-8000-000000000000',
        eventType: 'test.created',
        payload: {},
      },
    });
    try {
      // The version nibble is the first character of the third group.
      expect(event.id.split('-')[2]?.[0]).toBe('7');
    } finally {
      await prisma.outboxEvent.delete({ where: { id: event.id } });
    }
  });

  it('stores money as BigInt minor units', async () => {
    const household = await prisma.household.findFirst({ where: { name: 'Test family' } });
    expect(household?.weeklyFoodBudgetMinor).toBe(4_500_000n);
  });

  it('enforces one household membership per user', async () => {
    const member = await prisma.householdMember.findFirstOrThrow();
    await expect(
      prisma.householdMember.create({
        data: { householdId: member.householdId, userId: member.userId },
      }),
    ).rejects.toThrow();
  });
});
