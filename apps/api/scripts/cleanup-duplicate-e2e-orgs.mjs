/**
 * Cleanup script to remove duplicate E2E organizations from previous seed runs.
 * Keeps only the latest "LearnFlow E2E Org" with slug "e2e-org-fixture".
 *
 * Run from apps/api:  node scripts/cleanup-duplicate-e2e-orgs.mjs
 */
/* global console, process */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all duplicate E2E orgs (excluding the fixture one)
  const orgs = await prisma.organization.findMany({
    where: {
      name: 'LearnFlow E2E Org',
      slug: { not: 'e2e-org-fixture' },
    },
    include: {
      courses: {
        select: { id: true },
      },
    },
  });

  console.log(`Found ${orgs.length} duplicate E2E organizations to delete`);

  if (orgs.length === 0) {
    console.log('No duplicates found. Exiting.');
    return;
  }

  // Delete each duplicate org with proper cascade deletion
  for (const org of orgs) {
    // Delete order items for courses in this org
    const courseIds = org.courses.map((c) => c.id);
    if (courseIds.length > 0) {
      await prisma.orderItem.deleteMany({
        where: { courseId: { in: courseIds } },
      });
      console.log(`  ✓ Deleted ${courseIds.length} course order items`);
    }

    // Delete the organization (which cascades to courses, enrollments, etc.)
    await prisma.organization.delete({
      where: { id: org.id },
    });
    console.log(`✓ Deleted org: ${org.id} (slug: ${org.slug})`);
  }

  console.log(`\n✓ Cleanup complete: ${orgs.length} duplicate organizations removed`);
}

main()
  .catch((err) => {
    console.error('Cleanup failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
