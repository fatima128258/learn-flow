const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAdminUser() {
  try {
    console.log('🔍 Checking for admin user...\n');
    
    // Check user with admin email
    const user = await prisma.user.findUnique({
      where: { email: 'admin@gmail.com' }
    });
    
    if (!user) {
      console.log('❌ Admin user NOT FOUND in database');
      return;
    }
    
    console.log('✅ Admin user EXISTS in database:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email Verified: ${user.emailVerified}`);
    console.log(`   Created: ${user.createdAt}\n`);
    
    // Check organization memberships
    const memberships = await prisma.userOrganization.findMany({
      where: { userId: user.id },
      include: { organization: true }
    });
    
    if (memberships.length === 0) {
      console.log('❌ Admin user has NO organization memberships!');
    } else {
      console.log(`✅ Admin user has ${memberships.length} organization membership(s):`);
      memberships.forEach((m, i) => {
        console.log(`\n   Membership ${i + 1}:`);
        console.log(`     Role: ${m.role}`);
        console.log(`     Organization: ${m.organization.name} (${m.organization.slug})`);
        console.log(`     Organization ID: ${m.organizationId}`);
        console.log(`     Status: ${m.organization.status}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminUser();
