const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixAdminRole() {
  try {
    console.log('🔧 Fixing admin user role...\n');
    
    // Get admin user
    const user = await prisma.user.findUnique({
      where: { email: 'admin@gmail.com' }
    });
    
    if (!user) {
      console.log('❌ Admin user not found');
      return;
    }
    
    console.log('✅ Found admin user:', user.email);
    
    // Find or create platform organization
    let platformOrg = await prisma.organization.findUnique({
      where: { slug: 'platform' }
    });
    
    if (!platformOrg) {
      console.log('📦 Creating platform organization...');
      platformOrg = await prisma.organization.create({
        data: {
          name: 'Platform',
          slug: 'platform',
          status: 'ACTIVE'
        }
      });
      console.log('✅ Platform organization created');
    } else {
      console.log('✅ Platform organization exists');
    }
    
    // Check if membership already exists
    const existingMembership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: platformOrg.id
        }
      }
    });
    
    if (existingMembership) {
      console.log('⚠️  Membership already exists, updating role...');
      await prisma.userOrganization.update({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: platformOrg.id
          }
        },
        data: {
          role: 'PLATFORM_ADMIN'
        }
      });
      console.log('✅ Admin role updated to PLATFORM_ADMIN');
    } else {
      console.log('📝 Creating admin membership...');
      await prisma.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: platformOrg.id,
          role: 'PLATFORM_ADMIN'
        }
      });
      console.log('✅ Admin membership created with PLATFORM_ADMIN role');
    }
    
    // Verify the fix
    console.log('\n🔍 Verifying fix...');
    const memberships = await prisma.userOrganization.findMany({
      where: { userId: user.id },
      include: { organization: true }
    });
    
    console.log(`\n✅ Admin user now has ${memberships.length} membership(s):`);
    memberships.forEach((m, i) => {
      console.log(`\n   Membership ${i + 1}:`);
      console.log(`     Role: ${m.role}`);
      console.log(`     Organization: ${m.organization.name}`);
      console.log(`     Status: ${m.organization.status}`);
    });
    
    console.log('\n✅ Fix completed successfully!');
    console.log('\n📌 You can now login with:');
    console.log('   Email: admin@gmail.com');
    console.log('   Password: admin123');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdminRole();
