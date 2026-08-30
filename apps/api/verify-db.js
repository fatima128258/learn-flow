// Simple DB verification script that connects to Postgres via Prisma
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS script, require is appropriate
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const res = await prisma.$queryRaw`SELECT 1 as result`;
    console.log('Prisma connected, test query result:', res);
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Prisma connection error:', err);
    try { await prisma.$disconnect(); } catch (e) { console.error(e); }
    process.exit(2);
  }
}

main();
