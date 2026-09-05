const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking course progress for certificate eligibility...\n');

  const courseId = 'cmtn108wr000jgf016jg8qgpf'; // "Ta" course
  const organizationId = 'cmtn0sv9q0006gf01iqi9x6nl'; // "Test" org

  // Find all students in this organization enrolled in the course
  const enrollments = await prisma.enrollment.findMany({
    where: {
      courseId,
      status: 'ACTIVE',
      user: {
        organizations: {
          some: {
            organizationId,
            role: 'STUDENT'
          }
        }
      }
    },
    include: {
      user: true,
      course: {
        include: {
          modules: {
            include: {
              lessons: true
            }
          }
        }
      }
    }
  });

  console.log(`📊 Found ${enrollments.length} active enrollments for course "${enrollments[0]?.course.title || 'Ta'}"\n`);

  // Check progress for each student
  for (const enrollment of enrollments) {
    const student = enrollment.user;
    const course = enrollment.course;

    console.log(`============================================================`);
    console.log(`Student: ${student.name || student.email}`);
    console.log(`User ID: ${student.id}`);

    // Get course progress
    const courseProgress = await prisma.courseProgress.findUnique({
      where: {
        userId_courseId: {
          userId: student.id,
          courseId: course.id
        }
      }
    });

    if (courseProgress) {
      console.log(`📈 Progress: ${courseProgress.completionPercentage}%`);
      console.log(`🎯 Completed: ${courseProgress.completed ? '✅ YES' : '❌ NO'}`);
      if (courseProgress.completedAt) {
        console.log(`📅 Completed At: ${courseProgress.completedAt}`);
      }
      
      // Check if eligible for certificate
      if (courseProgress.completed && courseProgress.completionPercentage === 100) {
        console.log(`🎓 CERTIFICATE ELIGIBLE: ✅ YES`);
        
        // Check if certificate already exists
        const existingCert = await prisma.certificate.findUnique({
          where: {
            userId_courseId: {
              userId: student.id,
              courseId: course.id
            }
          }
        });

        if (existingCert) {
          console.log(`📜 Existing Certificate: ✅ YES (ID: ${existingCert.certificateId})`);
        } else {
          console.log(`📜 Existing Certificate: ❌ NO - Ready for generation!`);
        }
      } else {
        console.log(`🎓 CERTIFICATE ELIGIBLE: ❌ NO (${courseProgress.completionPercentage}% complete)`);
      }
    } else {
      console.log(`📈 Progress: Not started (0%)`);
      console.log(`🎓 CERTIFICATE ELIGIBLE: ❌ NO`);
    }
  }

  console.log(`============================================================\n`);

  // Show course structure
  const course = enrollments[0]?.course;
  if (course) {
    console.log(`📚 Course Structure for "${course.title}":`);
    console.log(`   Modules: ${course.modules.length}`);
    const totalLessons = course.modules.reduce((sum, module) => sum + module.lessons.length, 0);
    console.log(`   Total Lessons: ${totalLessons}`);
    
    for (const module of course.modules) {
      console.log(`   - Module: ${module.title} (${module.lessons.length} lessons)`);
    }
  }
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });