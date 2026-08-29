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

function uniqueEmail(name) {
  return `${name}-${Date.now()}@learnflow.test`;
}

async function main() {
  const passwordHash = await hash(PASSWORD);

  const org = await prisma.organization.create({
    data: { name: 'LearnFlow E2E Org', slug: `e2e-org-${Date.now()}`, status: 'ACTIVE' },
  });

  const platformAdmin = await prisma.user.create({
    data: { name: 'E2E Platform Admin', email: uniqueEmail('platformadmin'), passwordHash, emailVerified: true },
  });
  const orgAdmin = await prisma.user.create({
    data: { name: 'E2E Org Admin', email: uniqueEmail('orgadmin'), passwordHash, emailVerified: true },
  });
  const instructor = await prisma.user.create({
    data: { name: 'E2E Instructor', email: uniqueEmail('instructor'), passwordHash, emailVerified: true },
  });
  const student = await prisma.user.create({
    data: { name: 'E2E Student', email: uniqueEmail('student'), passwordHash, emailVerified: true },
  });
  // A second student reserved for the purchase spec so it never collides with
  // a fixture student who may already be enrolled from a prior run.
  const buyer = await prisma.user.create({
    data: { name: 'E2E Buyer', email: uniqueEmail('buyer'), passwordHash, emailVerified: true },
  });

  const role = (userId, role) =>
    prisma.userOrganization.create({ data: { userId, organizationId: org.id, role } });

  await Promise.all([
    role(platformAdmin.id, 'PLATFORM_ADMIN'),
    role(orgAdmin.id, 'ORG_ADMIN'),
    role(instructor.id, 'INSTRUCTOR'),
    role(student.id, 'STUDENT'),
    role(buyer.id, 'STUDENT'),
  ]);

  const category = await prisma.category.create({
    data: { organizationId: org.id, name: 'Development', slug: 'development' },
  });

  const published = await prisma.course.create({
    data: {
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

  const draft = await prisma.course.create({
    data: {
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

  const module = await prisma.module.create({
    data: { courseId: published.id, title: 'Getting Started', order: 1 },
  });
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
      platformAdmin: { email: platformAdmin.email },
      orgAdmin: { email: orgAdmin.email },
      instructor: { email: instructor.email },
      student: { email: student.email },
      buyer: { email: buyer.email },
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