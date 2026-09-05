const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugDashboardAccess() {
  try {
    console.log('🔍 Debugging organization dashboard access...\n');
    
    // Check which users can access organization dashboards
    const orgAdmins = await prisma.userOrganization.findMany({
      where: {
        OR: [
          { role: 'ORG_ADMIN' },
          { role: 'PLATFORM_ADMIN' }
        ]
      },
      include: {
        user: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true
          }
        }
      }
    });
    
    console.log(`✅ Found ${orgAdmins.length} admin user(s) who should have dashboard access:\n`);
    
    orgAdmins.forEach((admin, i) => {
      console.log(`${i + 1}. ${admin.user.name || admin.user.email}`);
      console.log(`   User ID: ${admin.userId}`);
      console.log(`   Email: ${admin.user.email}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Organization: ${admin.organization.name} (${admin.organization.slug})`);
      console.log(`   Organization ID: ${admin.organizationId}`);
      console.log(`   Organization Status: ${admin.organization.status}`);
      console.log(`   User Email Verified: ${admin.user.emailVerified}`);
      console.log('');
    });
    
    // Check active sessions
    const sessions = await prisma.session.findMany({
      where: {
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: {
          include: {
            organizations: {
              include: {
                organization: true
              }
            }
          }
        }
      }
    });
    
    console.log(`📊 Active sessions: ${sessions.length}\n`);
    
    sessions.forEach((session, i) => {
      console.log(`Session ${i + 1}:`);
      console.log(`   User: ${session.user.name || session.user.email}`);
      console.log(`   User ID: ${session.userId}`);
      console.log(`   Session ID: ${session.id}`);
      console.log(`   Created: ${session.createdAt}`);
      console.log(`   Expires: ${session.expiresAt}`);
      console.log(`   Organizations: ${session.user.organizations.length}`);
      
      if (session.user.organizations.length > 0) {
        session.user.organizations.forEach((org, j) => {
          console.log(`     ${j + 1}. ${org.organization.name} (${org.role})`);
        });
      }
      console.log('');
    });
    
    // Test specific dashboard access scenarios
    console.log('🧪 Testing dashboard access scenarios:\n');
    
    for (const admin of orgAdmins) {
      console.log(`Testing access for ${admin.user.name || admin.user.email}:`);
      
      try {
        // Simulate the dashboard service call
        const organization = await prisma.organization.findUnique({
          where: { id: admin.organizationId }
        });
        
        if (!organization) {
          console.log(`   ❌ Organization not found: ${admin.organizationId}`);
          continue;
        }
        
        console.log(`   ✅ Organization found: ${organization.name}`);
        
        // Check member counts (what the dashboard endpoint does)
        const memberCounts = await prisma.userOrganization.groupBy({
          by: ['role'],
          where: { organizationId: admin.organizationId },
          _count: { role: true }
        });
        
        const total = memberCounts.reduce((sum, group) => sum + group._count.role, 0);
        const instructors = memberCounts.find(g => g.role === 'INSTRUCTOR')?._count.role || 0;
        const students = memberCounts.find(g => g.role === 'STUDENT')?._count.role || 0;
        const orgAdminsCount = memberCounts.find(g => g.role === 'ORG_ADMIN')?._count.role || 0;
        
        console.log(`   📊 Member counts - Total: ${total}, Instructors: ${instructors}, Students: ${students}, Org Admins: ${orgAdminsCount}`);
        console.log(`   ✅ Dashboard data should load successfully`);
        
      } catch (error) {
        console.log(`   ❌ Error accessing dashboard: ${error.message}`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugDashboardAccess();