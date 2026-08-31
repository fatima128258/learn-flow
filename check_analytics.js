const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'admin@gmail.com' } });
  console.log('User:', user.email, 'emailVerified:', user.emailVerified);
  const memberships = await prisma.userOrganization.findMany({ where: { userId: user.id } });
  console.log('Memberships:', JSON.stringify(memberships, null, 2));
  
  // Check courses in Digital soft org
  const courses = await prisma.course.findMany({ where: { organizationId: 'cmth4wmnf0003vslg496a6v3j' } });
  console.log('Courses in Digital soft:', JSON.stringify(courses, null, 2));
  
  await prisma.$disconnect();
}

main();