import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const ORG_ID = 'cmtlfufv20000vs102old4c94';

async function main() {
  console.log('Checking courses in org:', ORG_ID);
  
  const courses = await prisma.course.findMany({
    where: { organizationId: ORG_ID },
    select: {
      id: true,
      title: true,
      status: true,
      publishedAt: true,
      instructorUser: { select: { name: true } }
    }
  });

  console.log(`\nTotal courses: ${courses.length}`);
  courses.forEach(c => {
    console.log(`\n  Title: ${c.title}`);
    console.log(`  Status: ${c.status}`);
    console.log(`  PublishedAt: ${c.publishedAt}`);
    console.log(`  Instructor: ${c.instructorUser.name}`);
  });

  const student = await prisma.user.findFirst({
    where: { email: 'student-1788434705311@learnflow.test' },
    select: { id: true, name: true, email: true }
  });

  console.log(`\n\nStudent user: ${student?.name} (${student?.email})`);

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: student?.id },
    select: {
      id: true,
      courseId: true,
      status: true,
      enrolledAt: true,
      course: { select: { title: true } }
    }
  });

  console.log(`Student enrollments: ${enrollments.length}`);
  enrollments.forEach(e => {
    console.log(`  - ${e.course.title} (${e.status})`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
