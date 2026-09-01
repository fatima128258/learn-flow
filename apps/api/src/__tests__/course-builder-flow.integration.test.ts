/**
 * Course Builder Flow Integration Test
 * 
 * Tests the complete course creation and student discovery workflow:
 * 1. Instructor creates a course (DRAFT)
 * 2. Instructor builds course structure (modules, lessons, quizzes, questions)
 * 3. Instructor publishes course
 * 4. Student discovers published course
 * 5. Student enrolls/purchases course
 * 6. Student accesses course content
 */

import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../server';
import getPrisma from '../prisma';

const prisma = getPrisma();
const ORIGIN = 'http://localhost:3000';
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'learnflow_session';

const runId = Date.now().toString(36);
let uid = 0;

function email(prefix: string): string {
  uid += 1;
  return `course-builder-${prefix}-${runId}-${uid}@example.test`;
}

function strongPassword(prefix = 'x') {
  return `${prefix}!${randomBytes(9).toString('base64url')}#${runId}`;
}

const ctx = {
  adminEmail: '',
  adminPassword: '',
  adminCookie: '',
  orgId: '',
  instructorEmail: '',
  instructorPassword: '',
  instructorCookie: '',
  studentEmail: '',
  studentPassword: '',
  studentCookie: '',
  courseId: '',
  courseSlug: '',
  moduleId: '',
  lessonIds: [] as string[],
  quizId: '',
  questionId: '',
  optionIds: [] as string[],
  correctOptionId: '',
};

function setCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const hit = list.find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!hit) throw new Error(`no '${COOKIE_NAME}' cookie`);
  return hit;
}

async function loginUser(e: string, password: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', ORIGIN)
    .send({ email: e, password });
  expect(res.status, `login(${e}) failed: ${String(res.body?.error)}`).toBe(200);
  return setCookie(res);
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
}, 30_000);

afterAll(async () => {
  // Cleanup test data
  if (ctx.courseId) {
    await prisma.course.deleteMany({ where: { id: ctx.courseId } }).catch(() => {});
  }
  if (ctx.orgId) {
    await prisma.organization.deleteMany({ where: { id: ctx.orgId } }).catch(() => {});
  }
  await prisma.$disconnect().catch(() => undefined);
}, 30_000);

describe('Course Builder Flow Integration Test', () => {
  
  it('1. Setup: Create platform admin and organization', async () => {
    ctx.adminPassword = strongPassword('admin');
    ctx.adminEmail = email('admin');
    const hash = await argon2.hash(ctx.adminPassword);
    
    const admin = await prisma.user.create({
      data: { 
        name: 'Test Admin', 
        email: ctx.adminEmail, 
        passwordHash: hash, 
        emailVerified: true 
      },
    });
    
    const org = await prisma.organization.create({ 
      data: { 
        name: 'Test Organization', 
        slug: `test-org-${runId}` 
      } 
    });
    
    await prisma.userOrganization.create({ 
      data: { 
        userId: admin.id, 
        organizationId: org.id, 
        role: 'PLATFORM_ADMIN' 
      } 
    });
    
    ctx.orgId = org.id;
    ctx.adminCookie = await loginUser(ctx.adminEmail, ctx.adminPassword);
    
    expect(ctx.orgId).toBeTruthy();
    expect(ctx.adminCookie).toBeTruthy();
  }, 30_000);

  it('2. Setup: Create instructor user', async () => {
    ctx.instructorEmail = email('instructor');
    ctx.instructorPassword = strongPassword('inst');
    
    const res = await request(app)
      .post('/api/v1/org/instructors')
      .set('Cookie', ctx.adminCookie)
      .set('Origin', ORIGIN)
      .send({
        name: 'Test Instructor',
        email: ctx.instructorEmail,
        password: ctx.instructorPassword,
      });
    
    expect(res.status, res.body?.error).toBe(201);
    expect(res.body.data.role).toBe('INSTRUCTOR');
    
    ctx.instructorCookie = await loginUser(ctx.instructorEmail, ctx.instructorPassword);
    expect(ctx.instructorCookie).toBeTruthy();
  }, 30_000);

  it('3. Setup: Create student user', async () => {
    ctx.studentEmail = email('student');
    ctx.studentPassword = strongPassword('stud');
    
    const res = await request(app)
      .post('/api/v1/org/students')
      .set('Cookie', ctx.adminCookie)
      .set('Origin', ORIGIN)
      .send({
        name: 'Test Student',
        email: ctx.studentEmail,
      });
    
    expect(res.status, res.body?.error).toBe(201);
    expect(res.body.data.role).toBe('STUDENT');
    
    // Set password for student
    const user = await prisma.user.findUnique({ where: { email: ctx.studentEmail } });
    expect(user).toBeTruthy();
    
    const hash = await argon2.hash(ctx.studentPassword);
    await prisma.user.update({
      where: { id: user!.id },
      data: { passwordHash: hash, emailVerified: true },
    });
    
    ctx.studentCookie = await loginUser(ctx.studentEmail, ctx.studentPassword);
    expect(ctx.studentCookie).toBeTruthy();
  }, 30_000);

  it('4. Instructor creates a course (DRAFT)', async () => {
    const res = await request(app)
      .post(`/api/v1/organizations/${ctx.orgId}/courses`)
      .set('Cookie', ctx.instructorCookie)
      .set('Origin', ORIGIN)
      .send({
        title: 'Complete React Course',
        slug: `react-course-${runId}`,
        description: 'Learn React from basics to advanced',
        category: 'Development',
        price: 99.99,
        discountPrice: 49.99,
        estimatedMinutes: 600,
        difficulty: 'Intermediate',
        learningObjectives: ['Master React hooks', 'Build real apps', 'Understand state management'],
      });
    
    expect(res.status, res.body?.error).toBe(201);
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.title).toBe('Complete React Course');
    
    ctx.courseId = res.body.data.id;
    ctx.courseSlug = res.body.data.slug;
  }, 30_000);

  it('5. DRAFT course is NOT visible in student search', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/search`)
      .set('Cookie', ctx.studentCookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    const courses = res.body.data || [];
    const found = courses.find((c: { id: string }) => c.id === ctx.courseId);
    expect(found).toBeUndefined();
  }, 30_000);

  it('6. Instructor creates a module', async () => {
    const res = await request(app)
      .post(`/api/v1/organizations/${ctx.orgId}/courses/${ctx.courseId}/modules`)
      .set('Cookie', ctx.instructorCookie)
      .set('Origin', ORIGIN)
      .send({
        title: 'Introduction to React',
        description: 'Get started with React basics',
        order: 1,
      });
    
    expect(res.status, res.body?.error).toBe(201);
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.title).toBe('Introduction to React');
    
    ctx.moduleId = res.body.data.id;
  }, 30_000);

  it('7. Instructor creates multiple lessons', async () => {
    const lessons = [
      { title: 'What is React?', content: 'React is a JavaScript library...', order: 1, duration: 15, isPreview: true },
      { title: 'Your First Component', content: 'Let\'s create a component...', order: 2, duration: 20, isPreview: false },
      { title: 'Props and State', content: 'Understanding props and state...', order: 3, duration: 25, isPreview: false },
    ];
    
    for (const lesson of lessons) {
      const res = await request(app)
        .post(`/api/v1/organizations/${ctx.orgId}/courses/${ctx.courseId}/modules/${ctx.moduleId}/lessons`)
        .set('Cookie', ctx.instructorCookie)
        .set('Origin', ORIGIN)
        .send(lesson);
      
      expect(res.status, res.body?.error).toBe(201);
      expect(res.body.data.id).toBeTruthy();
      ctx.lessonIds.push(res.body.data.id);
    }
    
    expect(ctx.lessonIds).toHaveLength(3);
  }, 30_000);

  it('8. Instructor creates a quiz', async () => {
    const res = await request(app)
      .post(`/api/v1/organizations/${ctx.orgId}/courses/${ctx.courseId}/modules/${ctx.moduleId}/quizzes`)
      .set('Cookie', ctx.instructorCookie)
      .set('Origin', ORIGIN)
      .send({
        title: 'React Basics Quiz',
        description: 'Test your knowledge',
        order: 1,
        passingPercentage: 70,
        maxAttempts: 3,
        timeLimitMinutes: 15,
      });
    
    expect(res.status, res.body?.error).toBe(201);
    expect(res.body.data.id).toBeTruthy();
    
    ctx.quizId = res.body.data.id;
  }, 30_000);

  it('9. Instructor creates quiz question with options', async () => {
    // Create question
    const questionRes = await request(app)
      .post(`/api/v1/organizations/${ctx.orgId}/courses/${ctx.courseId}/modules/${ctx.moduleId}/quizzes/${ctx.quizId}/questions`)
      .set('Cookie', ctx.instructorCookie)
      .set('Origin', ORIGIN)
      .send({
        questionText: 'What is JSX?',
        marks: 1,
        order: 1,
      });
    
    expect(questionRes.status, questionRes.body?.error).toBe(201);
    ctx.questionId = questionRes.body.data.id;
    
    // Create options
    const options = [
      { text: 'A syntax extension for JavaScript', isCorrect: true, order: 1 },
      { text: 'A new programming language', isCorrect: false, order: 2 },
      { text: 'A CSS framework', isCorrect: false, order: 3 },
      { text: 'A database system', isCorrect: false, order: 4 },
    ];
    
    for (const option of options) {
      const res = await request(app)
        .post(`/api/v1/organizations/${ctx.orgId}/courses/${ctx.courseId}/modules/${ctx.moduleId}/quizzes/${ctx.quizId}/questions/${ctx.questionId}/options`)
        .set('Cookie', ctx.instructorCookie)
        .set('Origin', ORIGIN)
        .send(option);
      
      expect(res.status, res.body?.error).toBe(201);
      ctx.optionIds.push(res.body.data.id);
      
      if (option.isCorrect) {
        ctx.correctOptionId = res.body.data.id;
      }
    }
    
    expect(ctx.optionIds).toHaveLength(4);
    expect(ctx.correctOptionId).toBeTruthy();
  }, 30_000);

  it('10. Verify course structure via database', async () => {
    const course = await prisma.course.findUnique({
      where: { id: ctx.courseId },
      include: {
        modules: {
          include: {
            lessons: true,
            quizzes: {
              include: {
                questions: {
                  include: {
                    options: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    
    expect(course).toBeTruthy();
    expect(course!.modules).toHaveLength(1);
    expect(course!.modules[0].lessons).toHaveLength(3);
    expect(course!.modules[0].quizzes).toHaveLength(1);
    expect(course!.modules[0].quizzes[0].questions).toHaveLength(1);
    expect(course!.modules[0].quizzes[0].questions[0].options).toHaveLength(4);
    
    const correctOption = course!.modules[0].quizzes[0].questions[0].options.find(o => o.isCorrect);
    expect(correctOption).toBeTruthy();
    expect(correctOption!.text).toBe('A syntax extension for JavaScript');
  }, 30_000);

  it('11. Instructor publishes the course', async () => {
    const res = await request(app)
      .patch(`/api/v1/organizations/${ctx.orgId}/courses/${ctx.courseId}/status`)
      .set('Cookie', ctx.instructorCookie)
      .set('Origin', ORIGIN)
      .send({ status: 'PUBLISHED' });
    
    expect(res.status, res.body?.error).toBe(200);
    expect(res.body.data.status).toBe('PUBLISHED');
    expect(res.body.data.publishedAt).toBeTruthy();
  }, 30_000);

  it('12. PUBLISHED course IS visible in student search', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/search`)
      .set('Cookie', ctx.studentCookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    const courses = res.body.data || [];
    const found = courses.find((c: { id: string }) => c.id === ctx.courseId);
    
    expect(found).toBeTruthy();
    expect(found.title).toBe('Complete React Course');
    expect(found.status).toBe('PUBLISHED');
    expect(found.instructor).toBeTruthy();
  }, 30_000);

  it('13. Student can search for course by keyword', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/search?q=React`)
      .set('Cookie', ctx.studentCookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    const courses = res.body.data || [];
    const found = courses.find((c: { id: string }) => c.id === ctx.courseId);
    
    expect(found).toBeTruthy();
  }, 30_000);

  it('14. Student views course overview (not enrolled)', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/courses/${ctx.courseId}/overview`)
      .set('Cookie', ctx.studentCookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(ctx.courseId);
    expect(res.body.data.isEnrolled).toBe(false);
    expect(res.body.data.moduleCount).toBe(1);
    expect(res.body.data.lessonCount).toBe(3);
    expect(res.body.data.quizCount).toBe(1);
  }, 30_000);

  it('15. Student cannot access course content before enrollment', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/courses/${ctx.courseId}`)
      .set('Cookie', ctx.studentCookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('STUDENT_NOT_ENROLLED');
  }, 30_000);

  it('16. Student purchases/enrolls in course', async () => {
    const res = await request(app)
      .post(`/api/v1/organizations/${ctx.orgId}/student/courses/${ctx.courseId}/purchase`)
      .set('Cookie', ctx.studentCookie)
      .set('Origin', ORIGIN)
      .send({});
    
    expect(res.status, res.body?.error).toBe(201);
    expect(res.body.data.enrollmentId).toBeTruthy();
    expect(res.body.data.orderId).toBeTruthy();
    expect(res.body.data.courseId).toBe(ctx.courseId);
  }, 30_000);

  it('17. Student cannot purchase course again', async () => {
    const res = await request(app)
      .post(`/api/v1/organizations/${ctx.orgId}/student/courses/${ctx.courseId}/purchase`)
      .set('Cookie', ctx.studentCookie)
      .set('Origin', ORIGIN)
      .send({});
    
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ALREADY_ENROLLED');
  }, 30_000);

  it('18. Student can now access course content', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/courses/${ctx.courseId}`)
      .set('Cookie', ctx.studentCookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    expect(res.body.data.courseId).toBe(ctx.courseId);
    expect(res.body.data.modules).toBeTruthy();
    expect(res.body.data.modules).toHaveLength(1);
  }, 30_000);

  it('19. Student can access lessons', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/courses/${ctx.courseId}/modules/${ctx.moduleId}/lessons/${ctx.lessonIds[1]}`)
      .set('Cookie', ctx.studentCookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    expect(res.body.data.lesson.id).toBe(ctx.lessonIds[1]);
    expect(res.body.data.lesson.title).toBe('Your First Component');
  }, 30_000);

  it('20. Instructor archives course', async () => {
    const res = await request(app)
      .patch(`/api/v1/organizations/${ctx.orgId}/courses/${ctx.courseId}/status`)
      .set('Cookie', ctx.instructorCookie)
      .set('Origin', ORIGIN)
      .send({ status: 'ARCHIVED' });
    
    expect(res.status, res.body?.error).toBe(200);
    expect(res.body.data.status).toBe('ARCHIVED');
  }, 30_000);

  it('21. ARCHIVED course is NOT visible in student search', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/search`)
      .set('Cookie', ctx.studentCookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    const courses = res.body.data || [];
    const found = courses.find((c: { id: string }) => c.id === ctx.courseId);
    expect(found).toBeUndefined();
  }, 30_000);

  it('22. Already enrolled student can still access archived course', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/courses/${ctx.courseId}`)
      .set('Cookie', ctx.studentCookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    expect(res.body.data.courseId).toBe(ctx.courseId);
  }, 30_000);
});
