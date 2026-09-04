// Delete All Organizations Properly
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAllOrganizationsProperly() {
  console.log('Deleting ALL organizations and related data...');
  
  try {
    // Count before deletion
    const beforeCount = await prisma.organization.count();
    console.log(`Found ${beforeCount} organizations before deletion.`);
    
    if (beforeCount === 0) {
      console.log('No organizations to delete.');
      return;
    }
    
    // List what we're deleting
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true, slug: true }
    });
    
    console.log('\nOrganizations being deleted:');
    orgs.forEach(org => console.log(`  - ${org.name} (${org.slug}) - ID: ${org.id}`));
    
    console.log('\n⚠️  Deleting in proper order to handle foreign key constraints...');
    
    // Delete in proper order to handle foreign key constraints
    // Based on Prisma schema relationships
    
    // First, delete data that has direct foreign key constraints
    console.log('1. Deleting OrderItems...');
    await prisma.orderItem.deleteMany({});
    
    console.log('2. Deleting Payments...');
    await prisma.payment.deleteMany({});
    
    console.log('3. Deleting Orders...');
    await prisma.order.deleteMany({});
    
    console.log('4. Deleting QuizAttempts...');
    await prisma.quizAttempt.deleteMany({});
    
    console.log('5. Deleting QuizOptions...');
    await prisma.quizOption.deleteMany({});
    
    console.log('6. Deleting Questions...');
    await prisma.question.deleteMany({});
    
    console.log('7. Deleting Quizzes...');
    await prisma.quiz.deleteMany({});
    
    console.log('8. Deleting LessonProgress...');
    await prisma.lessonProgress.deleteMany({});
    
    console.log('9. Deleting CourseProgress...');
    await prisma.courseProgress.deleteMany({});
    
    console.log('10. Deleting Certificates...');
    await prisma.certificate.deleteMany({});
    
    console.log('11. Deleting Media...');
    await prisma.media.deleteMany({});
    
    console.log('12. Deleting Notifications...');
    await prisma.notification.deleteMany({});
    
    console.log('13. Deleting Enrollments...');
    await prisma.enrollment.deleteMany({});
    
    console.log('14. Deleting Lessons...');
    await prisma.lesson.deleteMany({});
    
    console.log('15. Deleting Modules...');
    await prisma.module.deleteMany({});
    
    console.log('16. Deleting Courses...');
    await prisma.course.deleteMany({});
    
    console.log('17. Deleting Categories...');
    await prisma.category.deleteMany({});
    
    console.log('18. Deleting UserOrganization relationships...');
    await prisma.userOrganization.deleteMany({});
    
    console.log('19. Deleting AuditLogs...');
    await prisma.auditLog.deleteMany({});
    
    // Finally, delete organizations
    console.log('20. Deleting Organizations...');
    const result = await prisma.organization.deleteMany({});
    
    console.log(`\n✅ SUCCESS: Deleted ${result.count} organizations and ALL related data.`);
    console.log('\n⚠️  Database now has ZERO organizations.');
    console.log('You can run "npm run seed" to create fresh organizations.');
    
    // Verify
    const afterCount = await prisma.organization.count();
    console.log(`\nVerification: ${afterCount} organizations remain in database.`);
    
  } catch (error) {
    console.error('Error deleting organizations:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllOrganizationsProperly().catch(console.error);