const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const courses = await prisma.course.findMany({
    include: { organization: true }
  });
  console.log('All courses:', JSON.stringify(courses, null, 2));
  
  await prisma.$disconnect();
}

main();