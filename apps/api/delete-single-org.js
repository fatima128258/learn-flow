const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteOrganizationByAdminEmail() {
  try {
    const adminEmail = 'e2e-org2-admin-mtmzmw7r-3@example.test';
    
    console.log(`🔍 Finding organization with admin email: ${adminEmail}\n`);
    
    // Find the admin user
    const adminUser = await prisma.user.findUnique({
      where: { email: adminEmail }
    });
    
    if (!adminUser) {
      console.log('❌ Admin user not found');
      return;
    }
    
    console.log(`✅ Found admin user: ${adminUser.email}`);
    console.log(`   User ID: ${adminUser.id}\n`);
    
    // Find the organization membership
    const membership = await prisma.userOrganization.findFirst({
      where: {
        userId: adminUser.id,
        role: 'ORG_ADMIN'
      },
      include: {
        organization: true
      }
    });
    
    if (!membership) {
      console.log('❌ No organization membership found for this admin');
      return;
    }
    
    const org = membership.organization;
    console.log(`✅ Found organization:`);
    console.log(`   Name: ${org.name}`);
    console.log(`   Slug: ${org.slug}`);
    console.log(`   ID: ${org.id}`);
    console.log(`   Status: ${org.status}\n`);
    
    // Count related records before deletion
    console.log('📊 Checking related records...');
    const [
      coursesCount,
      enrollmentsCount,
      usersCount,
      notificationsCount,
      ordersCount,
      categoriesCount
    ] = await Promise.all([
      prisma.course.count({ where: { organizationId: org.id } }),
      prisma.enrollment.count({ where: { organizationId: org.id } }),
      prisma.userOrganization.count({ where: { organizationId: org.id } }),
      prisma.notification.count({ where: { organizationId: org.id } }),
      prisma.order.count({ where: { organizationId: org.id } }),
      prisma.category.count({ where: { organizationId: org.id } })
    ]);
    
    console.log(`   Courses: ${coursesCount}`);
    console.log(`   Enrollments: ${enrollmentsCount}`);
    console.log(`   Users: ${usersCount}`);
    console.log(`   Notifications: ${notificationsCount}`);
    console.log(`   Orders: ${ordersCount}`);
    console.log(`   Categories: ${categoriesCount}\n`);
    
    console.log('⚠️  WARNING: This will delete the organization and ALL related data!');
    console.log('   Press Ctrl+C to cancel or wait 3 seconds to proceed...\n');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('🗑️  Deleting organization...');
    
    await prisma.organization.delete({
      where: { id: org.id }
    });
    
    console.log(`✅ Organization "${org.name}" deleted successfully!`);
    console.log(`   All related records were automatically deleted due to CASCADE.`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteOrganizationByAdminEmail();
