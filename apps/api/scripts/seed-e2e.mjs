/**
 * E2E fixture seeder.
 *
 * Provises the deterministic data the Playwright suite needs, directly in the
 * database so the specs never depend on hand-created state:
 *   - one ACTIVE organization
 *   - a platform admin, org admin, instructor and a verified student
 *     (all with the known password E2Epass123!)
 *   - one PUBLISHED course with a module / lessons / quiz, and one DRAFT course
 *
 * Run from apps/api:  node scripts/seed-e2e.mjs
 * The result (ids + credentials) is written to apps/web/e2e/.local/seed.json.
 */
/* global console, process */
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();

const PASSWORD = 'E2Epass123!';
const OUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../web/e2e/.local/seed.json',
);

async function main() {
  const passwordHash = await hash(PASSWORD);

  // Use consistent slug for upsert - fixes duplicate org issue
  const E2E_ORG_SLUG = 'e2e-org-fixture';
  const org = await prisma.organization.upsert({
    where: { slug: E2E_ORG_SLUG },
    update: { status: 'ACTIVE' },
    create: { name: 'LearnFlow E2E Org', slug: E2E_ORG_SLUG, status: 'ACTIVE' },
  });

  // Use deterministic emails for upsert instead of timestamp-based
  const platformAdminEmail = 'e2e-platformadmin@learnflow.test';
  const orgAdminEmail = 'e2e-orgadmin@learnflow.test';
  const instructorEmail = 'e2e-instructor@learnflow.test';
  const studentEmail = 'e2e-student@learnflow.test';
  const buyerEmail = 'e2e-buyer@learnflow.test';

  const platformAdmin = await prisma.user.upsert({
    where: { email: platformAdminEmail },
    update: { name: 'E2E Platform Admin', passwordHash, emailVerified: true },
    create: { name: 'E2E Platform Admin', email: platformAdminEmail, passwordHash, emailVerified: true },
  });
  const orgAdmin = await prisma.user.upsert({
    where: { email: orgAdminEmail },
    update: { name: 'E2E Org Admin', passwordHash, emailVerified: true },
    create: { name: 'E2E Org Admin', email: orgAdminEmail, passwordHash, emailVerified: true },
  });
  const instructor = await prisma.user.upsert({
    where: { email: instructorEmail },
    update: { name: 'E2E Instructor', passwordHash, emailVerified: true },
    create: { name: 'E2E Instructor', email: instructorEmail, passwordHash, emailVerified: true },
  });
  const student = await prisma.user.upsert({
    where: { email: studentEmail },
    update: { name: 'E2E Student', passwordHash, emailVerified: true },
    create: { name: 'E2E Student', email: studentEmail, passwordHash, emailVerified: true },
  });
  // A second student reserved for the purchase spec so it never collides with
  // a fixture student who may already be enrolled from a prior run.
  const buyer = await prisma.user.upsert({
    where: { email: buyerEmail },
    update: { name: 'E2E Buyer', passwordHash, emailVerified: true },
    create: { name: 'E2E Buyer', email: buyerEmail, passwordHash, emailVerified: true },
  });

  const role = (userId, roleType) =>
    prisma.userOrganization.upsert({
      where: { userId_organizationId: { userId, organizationId: org.id } },
      update: { role: roleType },
      create: { userId, organizationId: org.id, role: roleType },
    });

  await Promise.all([
    role(platformAdmin.id, 'PLATFORM_ADMIN'),
    role(orgAdmin.id, 'ORG_ADMIN'),
    role(instructor.id, 'INSTRUCTOR'),
    role(student.id, 'STUDENT'),
    role(buyer.id, 'STUDENT'),
  ]);

  const category = await prisma.category.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'development' } },
    update: { name: 'Development' },
    create: { organizationId: org.id, name: 'Development', slug: 'development' },
  });

  const published = await prisma.course.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'e2e-react-fundamentals' } },
    update: { status: 'PUBLISHED', publishedAt: new Date() },
    create: {
      organizationId: org.id,
      instructorUserId: instructor.id,
      title: 'E2E React Fundamentals',
      slug: 'e2e-react-fundamentals',
      description: 'A fixture course used by the end-to-end test suite.',
      price: 49.99,
      discountPrice: 29.99,
      categoryId: category.id,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      estimatedMinutes: 180,
      difficulty: 'Beginner',
      learningObjectives: ['Understand React', 'Build components'],
    },
  });

  const draft = await prisma.course.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'e2e-draft-course' } },
    update: { status: 'DRAFT' },
    create: {
      organizationId: org.id,
      instructorUserId: instructor.id,
      title: 'E2E Draft Course',
      slug: 'e2e-draft-course',
      description: 'A fixture course that must NOT be purchasable.',
      price: 10,
      categoryId: category.id,
      status: 'DRAFT',
      estimatedMinutes: 60,
      learningObjectives: [],
    },
  });

  const module = await prisma.module.upsert({
    where: { courseId_order: { courseId: published.id, order: 1 } },
    update: { title: 'Getting Started' },
    create: { courseId: published.id, title: 'Getting Started', order: 1 },
  });
  // Delete existing lessons and quiz to ensure clean state
  await prisma.quizAttempt.deleteMany({ where: { quiz: { moduleId: module.id } } });
  await prisma.quiz.deleteMany({ where: { moduleId: module.id } });
  await prisma.lessonProgress.deleteMany({ where: { lesson: { moduleId: module.id } } });
  await prisma.lesson.deleteMany({ where: { moduleId: module.id } });

  await prisma.lesson.createMany({
    data: [
      { moduleId: module.id, title: 'Introduction', content: 'Welcome to the course.', type: 'Article', order: 1, isPreview: true },
      { moduleId: module.id, title: 'JSX Basics', content: 'Anatomy of a component.', type: 'Article', order: 2 },
    ],
  });
  await prisma.quiz.create({
    data: {
      moduleId: module.id,
      title: 'Module check',
      order: 1,
      passingPercentage: 70,
      maxAttempts: 2,
    },
  });

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    organizationId: org.id,
    categoryId: category.id,
    courseId: published.id,
    draftCourseId: draft.id,
    moduleId: module.id,
    credentials: {
      password: PASSWORD,
      platformAdmin: { email: platformAdminEmail },
      orgAdmin: { email: orgAdminEmail },
      instructor: { email: instructorEmail },
      student: { email: studentEmail },
      buyer: { email: buyerEmail },
    },
  }, null, 2));

  console.log('Seeded E2E fixtures ->', OUT);
  console.log('org:', org.id, '| published course:', published.id, '| draft:', draft.id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());