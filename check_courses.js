const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const courses = await prisma.course.findMany();
  console.log('Courses:', JSON.stringify(courses, null, 2));
  
  const categories = await prisma.category.findMany();
  console.log('Categories:', JSON.stringify(categories, null, 2));
  
  await prisma.$disconnect();
}

main();