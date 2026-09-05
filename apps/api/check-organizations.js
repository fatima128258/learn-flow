const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkOrganizations() {
  try {
    console.log('🏢 Checking organizations...\n');
    
    const organizations = await prisma.organization.findMany({
      include: {
        _count: {
          select: {
            users: true,
            courses: true
          }
        },
        users: {
          include: {
            user: true
          }
        }
      }
    });
    
    if (organizations.length === 0) {
      console.log('❌ No organizations found');
      return;
    }
    
    console.log(`✅ Found ${organizations.length} organization(s):\n`);
    
    organizations.forEach((org, i) => {
      console.log(`${i + 1}. ${org.name} (${org.slug})`);
      console.log(`   ID: ${org.id}`);
      console.log(`   Status: ${org.status}`);
      console.log(`   Members: ${org._count.users}`);
      console.log(`   Courses: ${org._count.courses}`);
      console.log(`   Created: ${org.createdAt}`);
      
      if (org.users.length > 0) {
        console.log('   👥 Members:');
        org.users.forEach(member => {
          console.log(`      - ${member.user.name || member.user.email} (${member.role})`);
        });
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrganizations();