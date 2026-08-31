const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const memberships = await prisma.userOrganization.findMany({
    where: { userId: 'cmth1wrg50001vsok14xu850f' }
  });
  console.log('User memberships:', JSON.stringify(memberships, null, 2));
  
  const orgAdmins = await prisma.userOrganization.findMany({
    where: { role: 'ORG_ADMIN' }
  });
  console.log('All ORG_ADMIN memberships:', JSON.stringify(orgAdmins, null, 2));
  
  await prisma.$disconnect();
}

main();