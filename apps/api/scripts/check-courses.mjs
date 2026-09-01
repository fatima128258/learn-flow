/**
 * Check courses in database
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🔍 Checking database...\n');

  // Check organizations
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true, status: true }
  });
  console.log(`📊 Organizations (${orgs.length}):`);
  orgs.forEach(org => {
    console.log(`  - ${org.name} (${org.slug}) [${org.status}] - ID: ${org.id}`);
  });

  // Check users with their organization roles
  const users = await prisma.user.findMany({
    include: {
      organizations: {
        include: { organization: true }
      }
    }
  });
  console.log(`\n👥 Users (${users.length}):`);
  users.forEach(user => {
    const roles = user.organizations.map(uo => `${uo.role}@${uo.organization.name}`).join(', ');
    console.log(`  - ${user.name || 'Unnamed'} (${user.email}) - ${roles || 'No roles'}`);
  });

  // Check courses
  const courses = await prisma.course.findMany({
    include: {
      instructorUser: true,
      organization: true
    }
  });
  console.log(`\n📚 Courses (${courses.length}):`);
  if (courses.length === 0) {
    console.log('  ⚠️ NO COURSES FOUND IN DATABASE');
  } else {
    courses.forEach(course => {
      console.log(`  - "${course.title}"`);
      console.log(`    Status: ${course.status}`);
      console.log(`    Org: ${course.organization.name}`);
      console.log(`    Instructor: ${course.instructorUser?.name || 'N/A'}`);
      console.log(`    Published: ${course.publishedAt ? 'Yes' : 'No'}`);
      console.log(`    ID: ${course.id}\n`);
    });
  }

  // Check categories
  const categories = await prisma.category.findMany();
  console.log(`🏷️  Categories (${categories.length}):`);
  if (categories.length === 0) {
    console.log('  ⚠️ NO CATEGORIES FOUND');
  } else {
    categories.forEach(cat => {
      console.log(`  - ${cat.name} (${cat.slug})`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
