const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'admin@gmail.com' } });
  console.log('User:', JSON.stringify(user, null, 2));
  const orgs = await prisma.userOrganization.findMany({ where: { userId: user.id } });
  console.log('Orgs:', JSON.stringify(orgs, null, 2));
  await prisma.$disconnect();
}

main();