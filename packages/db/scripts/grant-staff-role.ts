// Give a signed-up user a staff role. Used once, to make the first admin; after that, admins
// invite staff from the staff console. Recorded in the audit log.
// Usage: pnpm staff:grant <email> <dietitian|ops|admin>
import { createPrismaClient } from '../src/client.js';
import { StaffRoleType } from '../src/generated/prisma/enums.js';

const [email, role] = process.argv.slice(2).filter((a) => a !== '--');
const roles = Object.values(StaffRoleType) as string[];
if (!email || !role || !roles.includes(role)) {
  console.error(`Usage: pnpm staff:grant <email> <${roles.join('|')}>`);
  process.exit(2);
}

const prisma = createPrismaClient();
try {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    console.error(`No user with email ${email}. They must sign up first.`);
    process.exitCode = 1;
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.staffRole.upsert({
        where: { userId_role: { userId: user.id, role: role as StaffRoleType } },
        create: { userId: user.id, role: role as StaffRoleType },
        update: { revokedAt: null, grantedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorType: 'system',
          action: 'staff_role.granted_by_cli',
          entityType: 'user',
          entityId: user.id,
          metadata: { role },
        },
      });
    });
    console.log(
      `${email} is now ${role}. They need 2-step verification on to use the staff console.`,
    );
  }
} finally {
  await prisma.$disconnect();
}
