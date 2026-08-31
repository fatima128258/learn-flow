const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findUnique({ where: { id: 'cmth1wra60000vsokveat0i9w' } });
  console.log('Platform Org:', JSON.stringify(org, null, 2));
  
  // Check all organizations
  const orgs = await prisma.organization.findMany();
  console.log('All Orgs:', JSON.stringify(orgs, null, 2));
  
  await prisma.$disconnect();
}

main();