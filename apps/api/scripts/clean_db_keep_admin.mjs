import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDatabase() {
  try {
    console.log('🗑️  Starting database cleanup (keeping admin users)...');

    // Get all PLATFORM_ADMIN users to preserve
    const adminUsers = await prisma.userOrganization.findMany({
      where: { role: 'PLATFORM_ADMIN' },
      select: { userId: true },
      distinct: ['userId'],
    });

    const adminUserIds = adminUsers.map(a => a.userId);
    console.log(`Found ${adminUserIds.length} admin user(s): ${adminUserIds.join(', ')}`);

    // Delete in order of dependencies
    console.log('Deleting audit logs...');
    await prisma.auditLog.deleteMany({});

    console.log('Deleting certificates...');
    await prisma.certificate.deleteMany({});

    console.log('Deleting quiz attempts...');
    await prisma.quizAttempt.deleteMany({});

    console.log('Deleting lesson progress...');
    await prisma.lessonProgress.deleteMany({});

    console.log('Deleting course progress...');
    await prisma.courseProgress.deleteMany({});

    console.log('Deleting enrollments...');
    await prisma.enrollment.deleteMany({});

    console.log('Deleting payments...');
    await prisma.payment.deleteMany({});

    console.log('Deleting order items...');
    await prisma.orderItem.deleteMany({});

    console.log('Deleting orders...');
    await prisma.order.deleteMany({});

    console.log('Deleting quiz options...');
    await prisma.quizOption.deleteMany({});

    console.log('Deleting questions...');
    await prisma.question.deleteMany({});

    console.log('Deleting quizzes...');
    await prisma.quiz.deleteMany({});

    console.log('Deleting lessons...');
    await prisma.lesson.deleteMany({});

    console.log('Deleting modules...');
    await prisma.module.deleteMany({});

    console.log('Deleting courses...');
    await prisma.course.deleteMany({});

    console.log('Deleting media...');
    await prisma.media.deleteMany({});

    console.log('Deleting notifications...');
    await prisma.notification.deleteMany({});

    console.log('Deleting categories...');
    await prisma.category.deleteMany({});

    console.log('Deleting non-admin users and their sessions...');
    const nonAdminUsers = await prisma.user.findMany({
      where: { id: { notIn: adminUserIds } },
      select: { id: true },
    });

    for (const user of nonAdminUsers) {
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    }

    await prisma.user.deleteMany({
      where: { id: { notIn: adminUserIds } },
    });

    console.log('Deleting non-admin user organizations...');
    await prisma.userOrganization.deleteMany({
      where: { userId: { notIn: adminUserIds } },
    });

    console.log('Deleting orphaned organizations...');
    const orgsWithUsers = await prisma.userOrganization.findMany({
      select: { organizationId: true },
      distinct: ['organizationId'],
    });

    const orgIds = orgsWithUsers.map(o => o.organizationId);
    await prisma.organization.deleteMany({
      where: { id: { notIn: orgIds } },
    });

    console.log('✅ Cleanup complete!');
    console.log(`\n📊 Remaining data:`);
    const userCount = await prisma.user.count();
    const orgCount = await prisma.organization.count();
    const orgAdminCount = await prisma.userOrganization.count();

    console.log(`  - Users: ${userCount} (admin only)`);
    console.log(`  - Organizations: ${orgCount}`);
    console.log(`  - User-Org memberships: ${orgAdminCount}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase();
