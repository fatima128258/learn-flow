// Delete All Organizations
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAllOrganizations() {
  console.log('Deleting ALL organizations...');
  
  try {
    // Count before deletion
    const beforeCount = await prisma.organization.count();
    console.log(`Found ${beforeCount} organizations before deletion.`);
    
    if (beforeCount === 0) {
      console.log('No organizations to delete.');
      return;
    }
    
    // List what we're deleting
    const orgs = await prisma.organization.findMany({
      select: { name: true, slug: true }
    });
    
    console.log('\nOrganizations being deleted:');
    orgs.forEach(org => console.log(`  - ${org.name} (${org.slug})`));
    
    // Delete all organizations (cascade will handle related data)
    const result = await prisma.organization.deleteMany({});
    
    console.log(`\n✅ SUCCESS: Deleted ${result.count} organizations and all related data.`);
    console.log('\n⚠️  Database now has ZERO organizations.');
    console.log('You can run "npm run seed" to create the platform organization again.');
    
  } catch (error) {
    console.error('Error deleting organizations:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllOrganizations().catch(console.error);