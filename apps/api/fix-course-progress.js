const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing course progress to make certificate eligible...\n');

  const courseId = 'cmtn108wr000jgf016jg8qgpf'; // "Ta" course
  const userId = 'cmtn18s8t000rgf01i3372044'; // First student "Sa"

  console.log(`Updating progress for user ${userId} in course ${courseId}`);

  // Update course progress to 100%
  const updated = await prisma.courseProgress.update({
    where: {
      userId_courseId: {
        userId,
        courseId
      }
    },
    data: {
      completed: true,
      completedAt: new Date()
    }
  });

  console.log('✅ Course progress updated:', {
    completionPercentage: updated.completionPercentage,
    completed: updated.completed,
    completedAt: updated.completedAt
  });

  console.log('\n🎓 Student is now eligible for certificate generation!');
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });