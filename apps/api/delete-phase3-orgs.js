const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deletePhase3OrgTwo() {
  try {
    console.log('🔍 Finding all "Phase 3 Org Two" organizations...\n');
    
    // Find all organizations with this name
    const organizations = await prisma.organization.findMany({
      where: {
        name: 'Phase 3 Org Two'
      },
      include: {
        users: {
          include: {
            user: true
          }
        }
      }
    });
    
    if (organizations.length === 0) {
      console.log('❌ No organizations found with name "Phase 3 Org Two"');
      return;
    }
    
    console.log(`✅ Found ${organizations.length} organization(s) with name "Phase 3 Org Two"\n`);
    
    for (let i = 0; i < organizations.length; i++) {
      const org = organizations[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Organization ${i + 1} of ${organizations.length}`);
      console.log(`${'='.repeat(60)}`);
      console.log(`   Name: ${org.name}`);
      console.log(`   Slug: ${org.slug}`);
      console.log(`   ID: ${org.id}`);
      console.log(`   Status: ${org.status}`);
      
      // Show admin users
      const admins = org.users.filter(u => u.role === 'ORG_ADMIN');
      if (admins.length > 0) {
        console.log(`   Admin(s):`);
        admins.forEach(admin => {
          console.log(`     - ${admin.user.email}`);
        });
      }
      
      // Count related records
      const [
        coursesCount,
        enrollmentsCount,
        usersCount,
        notificationsCount,
        ordersCount,
        categoriesCount,
        certificatesCount,
        mediaCount
      ] = await Promise.all([
        prisma.course.count({ where: { organizationId: org.id } }),
        prisma.enrollment.count({ where: { organizationId: org.id } }),
        prisma.userOrganization.count({ where: { organizationId: org.id } }),
        prisma.notification.count({ where: { organizationId: org.id } }),
        prisma.order.count({ where: { organizationId: org.id } }),
        prisma.category.count({ where: { organizationId: org.id } }),
        prisma.certificate.count({ where: { organizationId: org.id } }),
        prisma.media.count({ where: { organizationId: org.id } })
      ]);
      
      console.log(`\n   📊 Related records:`);
      console.log(`      Courses: ${coursesCount}`);
      console.log(`      Enrollments: ${enrollmentsCount}`);
      console.log(`      Users: ${usersCount}`);
      console.log(`      Notifications: ${notificationsCount}`);
      console.log(`      Orders: ${ordersCount}`);
      console.log(`      Categories: ${categoriesCount}`);
      console.log(`      Certificates: ${certificatesCount}`);
      console.log(`      Media Files: ${mediaCount}`);
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`⚠️  WARNING: This will delete ALL ${organizations.length} organization(s) and their related data!`);
    console.log('   Press Ctrl+C to cancel or wait 3 seconds to proceed...');
    console.log(`${'='.repeat(60)}\n`);
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('🗑️  Deleting organizations...\n');
    
    for (let i = 0; i < organizations.length; i++) {
      const org = organizations[i];
      console.log(`   [${i + 1}/${organizations.length}] Deleting "${org.name}" (${org.slug})...`);
      
      await prisma.organization.delete({
        where: { id: org.id }
      });
      
      console.log(`   ✅ Deleted successfully!`);
    }
    
    console.log(`\n✅ All ${organizations.length} "Phase 3 Org Two" organization(s) deleted successfully!`);
    console.log('   All related records were automatically deleted due to CASCADE.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

deletePhase3OrgTwo();
