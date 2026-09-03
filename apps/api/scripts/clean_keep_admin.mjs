import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting data cleanup - keeping admin user only...\n');

  try {
    // Get all users first
    const allUsers = await prisma.user.findMany();
    
    if (allUsers.length === 0) {
      console.log('❌ No users found in database. Nothing to clean.');
      return;
    }

    // Keep the first user (typically the admin)
    const adminUser = allUsers[0];
    console.log(`✓ Keeping user: ${adminUser.email} (ID: ${adminUser.id})`);
    console.log(`✓ Will delete ${allUsers.length - 1} other users\n`);

    // Delete data in order (respecting foreign keys)
    const tables = [
      { name: 'AuditLog', condition: true },
      { name: 'QuizAttempt', condition: true },
      { name: 'QuizOption', condition: true },
      { name: 'Question', condition: true },
      { name: 'Quiz', condition: true },
      { name: 'LessonProgress', condition: true },
      { name: 'Lesson', condition: true },
      { name: 'Module', condition: true },
      { name: 'CourseProgress', condition: true },
      { name: 'Certificate', condition: true },
      { name: 'Enrollment', condition: true },
      { name: 'Course', condition: true },
      { name: 'Category', condition: true },
      { name: 'OrderItem', condition: true },
      { name: 'Order', condition: true },
      { name: 'Payment', condition: true },
      { name: 'Media', condition: true },
      { name: 'Notification', condition: true },
      { name: 'Session', condition: true },
      { name: 'PasswordResetToken', condition: true },
      { name: 'EmailVerificationToken', condition: true },
      { name: 'UserOrganization', condition: true },
      { name: 'Organization', condition: true },
      { name: 'User', condition: `id != '${adminUser.id}'` },
    ];

    for (const table of tables) {
      if (table.condition === true) {
        // TRUNCATE entire table
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table.name}" RESTART IDENTITY CASCADE`);
        console.log(`✓ Truncated: ${table.name}`);
      } else {
        // DELETE with condition
        await prisma.$executeRawUnsafe(`DELETE FROM "${table.name}" WHERE ${table.condition}`);
        console.log(`✓ Deleted from: ${table.name} (except admin)`);
      }
    }

    console.log('\n✅ Cleanup complete! Admin user preserved.');
    console.log(`   Admin email: ${adminUser.email}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
