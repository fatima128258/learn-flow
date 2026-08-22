const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment before running the Prisma seed.');
  }

  const platformOrg = await prisma.organization.upsert({
    where: { slug: 'platform' },
    update: { name: 'Platform' },
    create: { name: 'Platform', slug: 'platform' },
  });

  const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'Platform Admin',
      passwordHash,
      emailVerified: true,
    },
    create: {
      email: adminEmail,
      name: 'Platform Admin',
      passwordHash,
      emailVerified: true,
    },
  });

  await prisma.userOrganization.upsert({
    where: {
      userId_organizationId: {
        userId: adminUser.id,
        organizationId: platformOrg.id,
      },
    },
    update: {
      role: 'PLATFORM_ADMIN',
    },
    create: {
      userId: adminUser.id,
      organizationId: platformOrg.id,
      role: 'PLATFORM_ADMIN',
    },
  });

  console.log(`Platform admin ready: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error('Platform admin seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
