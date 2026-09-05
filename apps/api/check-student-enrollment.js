const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkStudentData() {
  try {
    console.log('🔍 Checking student data and enrollments...\n');
    
    // Get all students
    const students = await prisma.userOrganization.findMany({
      where: { role: 'STUDENT' },
      include: {
        user: true,
        organization: true
      }
    });
    
    if (students.length === 0) {
      console.log('❌ No students found in database');
      return;
    }
    
    console.log(`✅ Found ${students.length} student(s)\n`);
    
    for (const student of students) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Student: ${student.user.name ?? student.user.email}`);
      console.log(`  Email: ${student.user.email}`);
      console.log(`  User ID: ${student.userId}`);
      console.log(`  Organization: ${student.organization.name}`);
      console.log(`  Organization ID: ${student.organizationId}`);
      
      // Check enrollments
      const enrollments = await prisma.enrollment.findMany({
        where: { userId: student.userId },
        include: { course: true }
      });
      
      console.log(`\n  📚 Enrollments: ${enrollments.length}`);
      
      if (enrollments.length === 0) {
        console.log('     ⚠️  No enrollments found for this student');
      } else {
        enrollments.forEach((enrollment, i) => {
          console.log(`\n     Enrollment ${i + 1}:`);
          console.log(`       Course: ${enrollment.course.title}`);
          console.log(`       Course ID: ${enrollment.courseId}`);
          console.log(`       Status: ${enrollment.status}`);
          console.log(`       Enrolled: ${enrollment.enrolledAt}`);
          console.log(`       Organization Match: ${enrollment.organizationId === student.organizationId ? '✅ Yes' : '❌ No (PROBLEM!)'}`);
        });
      }
      
      // Check available courses in same organization
      const availableCourses = await prisma.course.findMany({
        where: {
          organizationId: student.organizationId,
          status: 'PUBLISHED'
        }
      });
      
      console.log(`\n  📖 Available Published Courses: ${availableCourses.length}`);
      if (availableCourses.length > 0) {
        availableCourses.forEach(course => {
          const enrolled = enrollments.some(e => e.courseId === course.id);
          console.log(`     - ${course.title} (ID: ${course.id}) ${enrolled ? '✅ ENROLLED' : '❌ NOT ENROLLED'}`);
        });
      }
    }
    
    console.log(`\n${'='.repeat(60)}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStudentData();
