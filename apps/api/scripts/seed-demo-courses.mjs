/**
 * Seed demo published courses for testing
 * Run: node scripts/seed-demo-courses.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🌱 Seeding demo published courses...\n');

  // Find or create an organization
  let org = await prisma.organization.findFirst({
    where: { status: 'ACTIVE' }
  });

  if (!org) {
    console.log('📦 Creating demo organization...');
    org = await prisma.organization.create({
      data: {
        name: 'Demo Organization',
        slug: 'demo-org',
        status: 'ACTIVE'
      }
    });
    console.log(`✅ Created organization: ${org.name}`);
  } else {
    console.log(`✅ Using existing organization: ${org.name}`);
  }

  // Find an instructor
  let instructor = await prisma.user.findFirst({
    where: {
      organizations: {
        some: {
          organizationId: org.id,
          role: { in: ['INSTRUCTOR', 'ORG_ADMIN'] }
        }
      }
    }
  });

  if (!instructor) {
    console.log('⚠️  No instructor found. Please create an instructor user first via the UI.');
    console.log('   Or create one manually with role INSTRUCTOR or ORG_ADMIN');
    return;
  }

  console.log(`✅ Using instructor: ${instructor.name || instructor.email}`);

  // Create or find categories
  const categories = [];
  const categoryNames = ['Development', 'Design', 'Business', 'Marketing'];
  
  for (const name of categoryNames) {
    let category = await prisma.category.findFirst({
      where: { organizationId: org.id, name }
    });
    
    if (!category) {
      category = await prisma.category.create({
        data: {
          organizationId: org.id,
          name,
          slug: name.toLowerCase()
        }
      });
      console.log(`✅ Created category: ${name}`);
    }
    categories.push(category);
  }

  // Demo courses data
  const demoCourses = [
    {
      title: 'Complete React Development Course',
      slug: 'complete-react-development',
      description: 'Learn React from basics to advanced concepts. Build real-world projects and master modern React development.',
      price: 49.99,
      discountPrice: 29.99,
      categoryId: categories[0].id,
      difficulty: 'Beginner',
      estimatedMinutes: 480,
      learningObjectives: [
        'Master React fundamentals',
        'Build modern web applications',
        'Understand hooks and state management',
        'Deploy production-ready apps'
      ]
    },
    {
      title: 'JavaScript Essentials 2024',
      slug: 'javascript-essentials-2024',
      description: 'Master JavaScript fundamentals, ES6+ features, and modern development practices.',
      price: 39.99,
      discountPrice: 24.99,
      categoryId: categories[0].id,
      difficulty: 'Beginner',
      estimatedMinutes: 360,
      learningObjectives: [
        'Learn JavaScript from scratch',
        'Understand asynchronous programming',
        'Master ES6+ features',
        'Build interactive web applications'
      ]
    },
    {
      title: 'UI/UX Design Masterclass',
      slug: 'ui-ux-design-masterclass',
      description: 'Learn professional UI/UX design principles and create stunning user interfaces.',
      price: 59.99,
      discountPrice: null,
      categoryId: categories[1].id,
      difficulty: 'Intermediate',
      estimatedMinutes: 540,
      learningObjectives: [
        'Master design principles',
        'Create user-centered designs',
        'Use industry-standard tools',
        'Build a professional portfolio'
      ]
    },
    {
      title: 'Digital Marketing Fundamentals',
      slug: 'digital-marketing-fundamentals',
      description: 'Learn essential digital marketing strategies to grow your business online.',
      price: 0,
      discountPrice: null,
      categoryId: categories[3].id,
      difficulty: 'Beginner',
      estimatedMinutes: 240,
      learningObjectives: [
        'Understand digital marketing basics',
        'Master social media marketing',
        'Learn SEO fundamentals',
        'Create effective campaigns'
      ]
    },
    {
      title: 'Python for Data Science',
      slug: 'python-for-data-science',
      description: 'Master Python programming and data science libraries for data analysis and visualization.',
      price: 69.99,
      discountPrice: 49.99,
      categoryId: categories[0].id,
      difficulty: 'Intermediate',
      estimatedMinutes: 600,
      learningObjectives: [
        'Learn Python basics',
        'Master pandas and numpy',
        'Visualize data with matplotlib',
        'Build data analysis projects'
      ]
    }
  ];

  console.log('\n📚 Creating published courses...\n');

  for (const courseData of demoCourses) {
    // Check if course already exists
    const existing = await prisma.course.findFirst({
      where: {
        organizationId: org.id,
        slug: courseData.slug
      }
    });

    if (existing) {
      console.log(`⏭️  Skipping "${courseData.title}" - already exists`);
      continue;
    }

    const course = await prisma.course.create({
      data: {
        organizationId: org.id,
        instructorUserId: instructor.id,
        ...courseData,
        status: 'PUBLISHED',
        publishedAt: new Date()
      }
    });

    // Create a module with sample lesson
    const module = await prisma.module.create({
      data: {
        courseId: course.id,
        title: 'Getting Started',
        description: 'Introduction to the course',
        order: 0
      }
    });

    await prisma.lesson.create({
      data: {
        moduleId: module.id,
        title: 'Welcome to the Course',
        content: `Welcome to ${course.title}! In this course, you will learn everything you need to know to master this subject.`,
        type: 'Article',
        order: 0,
        isPreview: true,
        duration: 15
      }
    });

    console.log(`✅ Created course: "${course.title}" (${course.status})`);
  }

  console.log('\n✨ Demo courses seeded successfully!');
  console.log(`\n📊 Summary:`);
  const totalCourses = await prisma.course.count({ where: { organizationId: org.id, status: 'PUBLISHED' } });
  console.log(`   - Organization: ${org.name}`);
  console.log(`   - Total PUBLISHED courses: ${totalCourses}`);
  console.log(`   - Students can now see these courses in "Available Courses" page\n`);
}

main()
  .catch((err) => {
    console.error('\n❌ Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
