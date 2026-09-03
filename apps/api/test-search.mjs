import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const ORG_ID = 'cmtlfufv20000vs102old4c94';

async function main() {
  console.log('Testing searchPublishedCourses query...\n');

  // Exact query from searchRepository.ts
  const results = await prisma.course.findMany({
    where: {
      organizationId: ORG_ID,
      status: 'PUBLISHED',
    },
    include: {
      instructorUser: {
        select: {
          id: true,
          name: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: { publishedAt: 'desc' },
  });

  console.log(`Results from searchPublishedCourses query: ${results.length}`);
  results.forEach(c => {
    console.log(`\n  ID: ${c.id}`);
    console.log(`  Title: ${c.title}`);
    console.log(`  Status: ${c.status}`);
    console.log(`  Published: ${c.publishedAt}`);
    console.log(`  Instructor: ${c.instructorUser?.name}`);
  });

  // Also count
  const count = await prisma.course.count({
    where: {
      organizationId: ORG_ID,
      status: 'PUBLISHED',
    },
  });

  console.log(`\n\nTotal PUBLISHED courses in org: ${count}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
