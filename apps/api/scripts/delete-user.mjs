import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteUserByEmail(email) {
  try {
    console.log(`🗑️  Starting deletion of user: ${email}...`);

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      console.log(`❌ User with email ${email} not found.`);
      process.exit(0);
    }

    console.log(`Found user: ${user.name} (${user.email})`);
    console.log(`User ID: ${user.id}`);

    // Delete in order of dependencies
    console.log('\n🧹 Deleting associated data...');

    console.log('  - Deleting audit logs...');
    const auditLogsDeleted = await prisma.auditLog.deleteMany({
      where: { actorUserId: user.id },
    });
    console.log(`    ✓ Deleted ${auditLogsDeleted.count} audit logs`);

    console.log('  - Deleting certificates...');
    const certificatesDeleted = await prisma.certificate.deleteMany({
      where: { userId: user.id },
    });
    console.log(`    ✓ Deleted ${certificatesDeleted.count} certificates`);

    console.log('  - Deleting quiz attempts...');
    const quizAttemptsDeleted = await prisma.quizAttempt.deleteMany({
      where: { userId: user.id },
    });
    console.log(`    ✓ Deleted ${quizAttemptsDeleted.count} quiz attempts`);

    console.log('  - Deleting lesson progress...');
    const lessonProgressDeleted = await prisma.lessonProgress.deleteMany({
      where: { userId: user.id },
    });
    console.log(`    ✓ Deleted ${lessonProgressDeleted.count} lesson progress records`);

    console.log('  - Deleting course progress...');
    const courseProgressDeleted = await prisma.courseProgress.deleteMany({
      where: { userId: user.id },
    });
    console.log(`    ✓ Deleted ${courseProgressDeleted.count} course progress records`);

    console.log('  - Deleting enrollments...');
    const enrollmentsDeleted = await prisma.enrollment.deleteMany({
      where: { userId: user.id },
    });
    console.log(`    ✓ Deleted ${enrollmentsDeleted.count} enrollments`);

    console.log('  - Deleting payments...');
    const paymentsDeleted = await prisma.payment.deleteMany({
      where: { userId: user.id },
    });
    console.log(`    ✓ Deleted ${paymentsDeleted.count} payments`);

    console.log('  - Deleting orders...');
    const ordersDeleted = await prisma.order.deleteMany({
      where: { userId: user.id },
    });
    console.log(`    ✓ Deleted ${ordersDeleted.count} orders`);

    console.log('  - Deleting media...');
    const mediaDeleted = await prisma.media.deleteMany({
      where: { uploaderId: user.id },
    });
    console.log(`    ✓ Deleted ${mediaDeleted.count} media files`);

    console.log('  - Deleting notifications...');
    const notificationsDeleted = await prisma.notification.deleteMany({
      where: { userId: user.id },
    });
    console.log(`    ✓ Deleted ${notificationsDeleted.count} notifications`);

    console.log('  - Deleting sessions...');
    const sessionsDeleted = await prisma.session.deleteMany({
      where: { userId: user.id },
    });
    console.log(`    ✓ Deleted ${sessionsDeleted.count} sessions`);

    console.log('  - Deleting email verification tokens...');
    const emailTokensDeleted = await prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    });
    console.log(`    ✓ Deleted ${emailTokensDeleted.count} email verification tokens`);

    console.log('  - Deleting password reset tokens...');
    const passwordTokensDeleted = await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });
    console.log(`    ✓ Deleted ${passwordTokensDeleted.count} password reset tokens`);

    console.log('  - Deleting user-organization relationships...');
    const userOrgDeleted = await prisma.userOrganization.deleteMany({
      where: { userId: user.id },
    });
    console.log(`    ✓ Deleted ${userOrgDeleted.count} user-organization relationships`);

    console.log('  - Deleting user account...');
    const userDeleted = await prisma.user.delete({
      where: { id: user.id },
      select: { id: true, email: true },
    });
    console.log(`    ✓ Deleted user account`);

    console.log(`\n✅ Successfully deleted user: ${email}`);
    console.log(`\nSummary of deleted data:`);
    console.log(`  - Audit logs: ${auditLogsDeleted.count}`);
    console.log(`  - Certificates: ${certificatesDeleted.count}`);
    console.log(`  - Quiz attempts: ${quizAttemptsDeleted.count}`);
    console.log(`  - Lesson progress: ${lessonProgressDeleted.count}`);
    console.log(`  - Course progress: ${courseProgressDeleted.count}`);
    console.log(`  - Enrollments: ${enrollmentsDeleted.count}`);
    console.log(`  - Payments: ${paymentsDeleted.count}`);
    console.log(`  - Orders: ${ordersDeleted.count}`);
    console.log(`  - Media: ${mediaDeleted.count}`);
    console.log(`  - Notifications: ${notificationsDeleted.count}`);
    console.log(`  - Sessions: ${sessionsDeleted.count}`);
    console.log(`  - Email verification tokens: ${emailTokensDeleted.count}`);
    console.log(`  - Password reset tokens: ${passwordTokensDeleted.count}`);
    console.log(`  - User-org relationships: ${userOrgDeleted.count}`);

  } catch (error) {
    console.error('❌ Error during deletion:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.log('Usage: node delete-user.mjs <email>');
  console.log('Example: node delete-user.mjs ali@gmail.com');
  process.exit(1);
}

deleteUserByEmail(email);
