import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteOrganizationByIdentifier(identifier) {
  try {
    console.log(`🗑️  Starting deletion of organization: ${identifier}...`);

    // Find organization by name, slug, or by finding users with this email
    let organization;

    // First try to find by slug or name
    organization = await prisma.organization.findFirst({
      where: {
        OR: [
          { slug: identifier.toLowerCase() },
          { name: identifier },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            users: true,
            courses: true,
            categories: true,
          },
        },
      },
    });

    // If not found, try finding by user email associated with organization
    if (!organization) {
      const user = await prisma.user.findUnique({
        where: { email: identifier },
        select: { id: true, email: true, organizations: { select: { organizationId: true } } },
      });

      if (user && user.organizations.length > 0) {
        organization = await prisma.organization.findUnique({
          where: { id: user.organizations[0].organizationId },
          select: {
            id: true,
            name: true,
            slug: true,
            _count: {
              select: {
                users: true,
                courses: true,
                categories: true,
              },
            },
          },
        });
      }
    }

    if (!organization) {
      console.log(`❌ Organization matching "${identifier}" not found.`);
      process.exit(0);
    }

    console.log(`Found organization: ${organization.name} (${organization.slug})`);
    console.log(`Organization ID: ${organization.id}`);
    console.log(`  - Members: ${organization._count.users}`);
    console.log(`  - Courses: ${organization._count.courses}`);
    console.log(`  - Categories: ${organization._count.categories}`);

    // Delete in order of dependencies
    console.log('\n🧹 Deleting associated data...');

    console.log('  - Deleting audit logs...');
    const auditLogsDeleted = await prisma.auditLog.deleteMany({
      where: { organizationId: organization.id },
    });
    console.log(`    ✓ Deleted ${auditLogsDeleted.count} audit logs`);

    console.log('  - Deleting notifications...');
    const notificationsDeleted = await prisma.notification.deleteMany({
      where: { organizationId: organization.id },
    });
    console.log(`    ✓ Deleted ${notificationsDeleted.count} notifications`);

    console.log('  - Deleting certificates...');
    const certificatesDeleted = await prisma.certificate.deleteMany({
      where: { organizationId: organization.id },
    });
    console.log(`    ✓ Deleted ${certificatesDeleted.count} certificates`);

    console.log('  - Deleting payments...');
    const paymentsDeleted = await prisma.payment.deleteMany({
      where: { organizationId: organization.id },
    });
    console.log(`    ✓ Deleted ${paymentsDeleted.count} payments`);

    console.log('  - Deleting order items...');
    const ordersToDelete = await prisma.order.findMany({
      where: { organizationId: organization.id },
      select: { id: true },
    });
    const orderIds = ordersToDelete.map(o => o.id);
    const orderItemsDeleted = await prisma.orderItem.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    console.log(`    ✓ Deleted ${orderItemsDeleted.count} order items`);

    console.log('  - Deleting orders...');
    const ordersDeleted = await prisma.order.deleteMany({
      where: { organizationId: organization.id },
    });
    console.log(`    ✓ Deleted ${ordersDeleted.count} orders`);

    console.log('  - Deleting media...');
    try {
      const mediaDeleted = await prisma.media.deleteMany({
        where: { organizationId: organization.id },
      });
      console.log(`    ✓ Deleted ${mediaDeleted.count} media files`);
    } catch (e) {
      console.log(`    ⚠ Media deletion skipped (${e.message})`);
    }

    console.log('  - Deleting enrollments...');
    const enrollmentsDeleted = await prisma.enrollment.deleteMany({
      where: { organizationId: organization.id },
    });
    console.log(`    ✓ Deleted ${enrollmentsDeleted.count} enrollments`);

    console.log('  - Deleting course progress...');
    const courseProgressToDelete = await prisma.courseProgress.findMany({
      where: { organizationId: organization.id },
      select: { id: true },
    });
    const courseProgressIds = courseProgressToDelete.map(cp => cp.id);
    // Course progress will cascade delete with courses, but delete explicitly first
    const courseProgressDeleted = await prisma.courseProgress.deleteMany({
      where: { id: { in: courseProgressIds } },
    });
    console.log(`    ✓ Deleted ${courseProgressDeleted.count} course progress records`);

    console.log('  - Deleting lesson progress...');
    const lessonProgressDeleted = await prisma.lessonProgress.deleteMany({
      where: { organizationId: organization.id },
    });
    console.log(`    ✓ Deleted ${lessonProgressDeleted.count} lesson progress records`);

    console.log('  - Deleting quiz attempts...');
    const quizAttemptsDeleted = await prisma.quizAttempt.deleteMany({
      where: {
        quiz: {
          module: {
            course: {
              organizationId: organization.id,
            },
          },
        },
      },
    });
    console.log(`    ✓ Deleted ${quizAttemptsDeleted.count} quiz attempts`);

    console.log('  - Deleting quiz options and questions (via cascade)...');
    console.log('  - Deleting quizzes (via cascade)...');
    console.log('  - Deleting lessons and modules (via cascade)...');

    console.log('  - Deleting courses...');
    const coursesDeleted = await prisma.course.deleteMany({
      where: { organizationId: organization.id },
    });
    console.log(`    ✓ Deleted ${coursesDeleted.count} courses`);

    console.log('  - Deleting categories...');
    const categoriesDeleted = await prisma.category.deleteMany({
      where: { organizationId: organization.id },
    });
    console.log(`    ✓ Deleted ${categoriesDeleted.count} categories`);

    console.log('  - Deleting user-organization relationships...');
    const userOrgDeleted = await prisma.userOrganization.deleteMany({
      where: { organizationId: organization.id },
    });
    console.log(`    ✓ Deleted ${userOrgDeleted.count} user-organization relationships`);

    console.log('  - Deleting organization...');
    const orgDeleted = await prisma.organization.delete({
      where: { id: organization.id },
      select: { id: true, name: true },
    });
    console.log(`    ✓ Deleted organization`);

    console.log(`\n✅ Successfully deleted organization: ${organization.name}`);
    console.log(`\nSummary of deleted data:`);
    console.log(`  - Audit logs: ${auditLogsDeleted.count}`);
    console.log(`  - Notifications: ${notificationsDeleted.count}`);
    console.log(`  - Certificates: ${certificatesDeleted.count}`);
    console.log(`  - Payments: ${paymentsDeleted.count}`);
    console.log(`  - Order items: ${orderItemsDeleted.count}`);
    console.log(`  - Orders: ${ordersDeleted.count}`);
    console.log(`  - Media: ${mediaDeleted.count}`);
    console.log(`  - Enrollments: ${enrollmentsDeleted.count}`);
    console.log(`  - Course progress: ${courseProgressDeleted.count}`);
    console.log(`  - Lesson progress: ${lessonProgressDeleted.count}`);
    console.log(`  - Quiz attempts: ${quizAttemptsDeleted.count}`);
    console.log(`  - Courses: ${coursesDeleted.count}`);
    console.log(`  - Categories: ${categoriesDeleted.count}`);
    console.log(`  - User-org relationships: ${userOrgDeleted.count}`);

  } catch (error) {
    console.error('❌ Error during deletion:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get identifier from command line argument
const identifier = process.argv[2];

if (!identifier) {
  console.log('Usage: node delete-organization.mjs <name|slug|user-email>');
  console.log('Example: node delete-organization.mjs "My Organization"');
  console.log('Example: node delete-organization.mjs my-org-slug');
  console.log('Example: node delete-organization.mjs soft@gmail.com');
  process.exit(1);
}

deleteOrganizationByIdentifier(identifier);
