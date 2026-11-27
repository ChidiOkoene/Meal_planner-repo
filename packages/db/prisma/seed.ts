// Development seed data. Safe to run repeatedly: every record is upserted on a unique key.
// All people, emails and phone numbers here are fictional.
import { createPrismaClient } from '../src/client.js';
import { seedCatalogue } from './seed-catalogue.js';

const prisma = createPrismaClient();

async function main(): Promise<void> {
  // Staff
  const staff = [
    { email: 'admin@example.test', displayName: 'Ada Admin', role: 'admin' as const },
    { email: 'dietitian@example.test', displayName: 'Dayo Dietitian', role: 'dietitian' as const },
    { email: 'ops@example.test', displayName: 'Obi Ops', role: 'ops' as const },
  ];
  for (const { email, displayName, role } of staff) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, displayName, countryCode: 'NG' },
    });
    await prisma.staffRole.upsert({
      where: { userId_role: { userId: user.id, role } },
      update: {},
      create: { userId: user.id, role },
    });
  }

  // Payer abroad
  const payer = await prisma.user.upsert({
    where: { email: 'payer@example.test' },
    update: {},
    create: { email: 'payer@example.test', displayName: 'Tunde Test', countryCode: 'GB' },
  });

  // Household with one recipient in Lagos
  const recipientPhone = '+2340000000001';
  const existing = await prisma.recipient.findUnique({ where: { phoneE164: recipientPhone } });
  if (!existing) {
    await prisma.household.create({
      data: {
        name: 'Test family',
        status: 'active',
        billingCurrency: 'GBP',
        weeklyFoodBudgetMinor: 4_500_000n, // ₦45,000.00 in kobo
        weeklyFoodBudgetCurrency: 'NGN',
        members: { create: { userId: payer.id, role: 'owner' } },
        recipients: {
          create: {
            displayName: 'Mama Test',
            phoneE164: recipientPhone,
            phoneVerifiedAt: new Date(),
            language: 'pcm',
            status: 'active',
            address: {
              create: {
                line1: '12 Example Street',
                area: 'Surulere',
                city: 'Lagos',
                region: 'Lagos',
                countryCode: 'NG',
                landmark: 'Opposite the filling station, blue gate',
              },
            },
            consents: {
              create: [
                { type: 'whatsapp_messaging', method: 'whatsapp_reply', grantedAt: new Date() },
                { type: 'health_data_processing', method: 'whatsapp_reply', grantedAt: new Date() },
                { type: 'share_with_payer', method: 'whatsapp_reply', grantedAt: new Date() },
              ],
            },
          },
        },
      },
    });
  }

  // Sample food catalogue (development data, not dietitian-verified)
  await seedCatalogue(prisma);

  const counts = {
    users: await prisma.user.count(),
    households: await prisma.household.count(),
    recipients: await prisma.recipient.count(),
    ingredients: await prisma.ingredient.count(),
    dishes: await prisma.dish.count(),
  };
  console.log('Seed complete', counts);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
