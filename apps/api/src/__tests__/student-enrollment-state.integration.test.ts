/**
 * Student Enrollment State Integration Test
 * 
 * Verifies student-specific purchase/enrollment state behavior:
 * - Student A enrolls → Buy Now hidden for Student A, visible for Student B
 * - Button states update immediately without refresh
 * - State persists after logout/login
 * - Duplicate enrollment prevention
 * - Search page reflects enrollment status
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
  return `enrollment-state-${prefix}-${runId}-${uid}@example.test`;
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
  studentAEmail: '',
  studentAPassword: '',
  studentACookie: '',
  studentBEmail: '',
  studentBPassword: '',
  studentBCookie: '',
  paidCourseId: '',
  freeCourseId: '',
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
  if (ctx.paidCourseId) {
    await prisma.course.deleteMany({ where: { id: ctx.paidCourseId } }).catch(() => {});
  }
  if (ctx.freeCourseId) {
    await prisma.course.deleteMany({ where: { id: ctx.freeCourseId } }).catch(() => {});
  }
  if (ctx.orgId) {
    await prisma.organization.deleteMany({ where: { id: ctx.orgId } }).catch(() => {});
  }
  await prisma.$disconnect().catch(() => undefined);
}, 30_000);

describe('Student Enrollment State Integration Test', () => {
  
  it('1. Setup: Create admin, organization, and instructor', async () => {
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
    
    // Create instructor
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
    ctx.instructorCookie = await loginUser(ctx.instructorEmail, ctx.instructorPassword);
  }, 30_000);

  it('2. Setup: Create two students (A and B)', async () => {
    // Create Student A
    ctx.studentAEmail = email('studentA');
    ctx.studentAPassword = strongPassword('studA');
    
    const resA = await request(app)
      .post('/api/v1/org/students')
      .set('Cookie', ctx.adminCookie)
      .set('Origin', ORIGIN)
      .send({
        name: 'Test Student A',
        email: ctx.studentAEmail,
      });
    
    expect(resA.status, resA.body?.error).toBe(201);
    
    const userA = await prisma.user.findUnique({ where: { email: ctx.studentAEmail } });
    expect(userA).toBeTruthy();
    
    const hashA = await argon2.hash(ctx.studentAPassword);
    await prisma.user.update({
      where: { id: userA!.id },
      data: { passwordHash: hashA, emailVerified: true },
    });
    
    ctx.studentACookie = await loginUser(ctx.studentAEmail, ctx.studentAPassword);

    // Create Student B
    ctx.studentBEmail = email('studentB');
    ctx.studentBPassword = strongPassword('studB');
    
    const resB = await request(app)
      .post('/api/v1/org/students')
      .set('Cookie', ctx.adminCookie)
      .set('Origin', ORIGIN)
      .send({
        name: 'Test Student B',
        email: ctx.studentBEmail,
      });
    
    expect(resB.status, resB.body?.error).toBe(201);
    
    const userB = await prisma.user.findUnique({ where: { email: ctx.studentBEmail } });
    expect(userB).toBeTruthy();
    
    const hashB = await argon2.hash(ctx.studentBPassword);
    await prisma.user.update({
      where: { id: userB!.id },
      data: { passwordHash: hashB, emailVerified: true },
    });
    
    ctx.studentBCookie = await loginUser(ctx.studentBEmail, ctx.studentBPassword);
  }, 30_000);

  it('3. Setup: Create and publish a paid course', async () => {
    const res = await request(app)
      .post(`/api/v1/organizations/${ctx.orgId}/courses`)
      .set('Cookie', ctx.instructorCookie)
      .set('Origin', ORIGIN)
      .send({
        title: 'Paid Course',
        slug: `paid-course-${runId}`,
        description: 'A course that costs money',
        category: 'Technology',
        price: 29.99,
        estimatedMinutes: 120,
        difficulty: 'Beginner',
        learningObjectives: ['Learn paid content'],
      });
    
    expect(res.status, res.body?.error).toBe(201);
    ctx.paidCourseId = res.body.data.id;
    
    // Publish the course
    await request(app)
      .patch(`/api/v1/organizations/${ctx.orgId}/courses/${ctx.paidCourseId}/status`)
      .set('Cookie', ctx.instructorCookie)
      .set('Origin', ORIGIN)
      .send({ status: 'PUBLISHED' });
  }, 30_000);

  it('4. Setup: Create and publish a free course', async () => {
    const res = await request(app)
      .post(`/api/v1/organizations/${ctx.orgId}/courses`)
      .set('Cookie', ctx.instructorCookie)
      .set('Origin', ORIGIN)
      .send({
        title: 'Free Course',
        slug: `free-course-${runId}`,
        description: 'A free course',
        category: 'Technology',
        price: 0,
        estimatedMinutes: 60,
        difficulty: 'Beginner',
        learningObjectives: ['Learn free content'],
      });
    
    expect(res.status, res.body?.error).toBe(201);
    ctx.freeCourseId = res.body.data.id;
    
    // Publish the course
    await request(app)
      .patch(`/api/v1/organizations/${ctx.orgId}/courses/${ctx.freeCourseId}/status`)
      .set('Cookie', ctx.instructorCookie)
      .set('Origin', ORIGIN)
      .send({ status: 'PUBLISHED' });
  }, 30_000);

  it('5. Student A: Search shows both courses NOT enrolled', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/search`)
      .set('Cookie', ctx.studentACookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    const courses = res.body.data || [];
    
    const paidCourse = courses.find((c: { id: string }) => c.id === ctx.paidCourseId);
    const freeCourse = courses.find((c: { id: string }) => c.id === ctx.freeCourseId);
    
    expect(paidCourse).toBeTruthy();
    expect(paidCourse.isEnrolled).toBe(false);
    
    expect(freeCourse).toBeTruthy();
    expect(freeCourse.isEnrolled).toBe(false);
  }, 30_000);

  it('6. Student B: Search shows both courses NOT enrolled', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/search`)
      .set('Cookie', ctx.studentBCookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    const courses = res.body.data || [];
    
    const paidCourse = courses.find((c: { id: string }) => c.id === ctx.paidCourseId);
    const freeCourse = courses.find((c: { id: string }) => c.id === ctx.freeCourseId);
    
    expect(paidCourse).toBeTruthy();
    expect(paidCourse.isEnrolled).toBe(false);
    
    expect(freeCourse).toBeTruthy();
    expect(freeCourse.isEnrolled).toBe(false);
  }, 30_000);

  it('7. Student A: View paid course overview (not enrolled)', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/courses/${ctx.paidCourseId}/overview`)
      .set('Cookie', ctx.studentACookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(ctx.paidCourseId);
    expect(res.body.data.isEnrolled).toBe(false);
    expect(res.body.data.price).toBe(29.99);
  }, 30_000);

  it('8. Student A: Purchase paid course', async () => {
    const res = await request(app)
      .post(`/api/v1/organizations/${ctx.orgId}/student/courses/${ctx.paidCourseId}/purchase`)
      .set('Cookie', ctx.studentACookie)
      .set('Origin', ORIGIN)
      .send({});
    
    expect(res.status, res.body?.error).toBe(201);
    expect(res.body.data.enrollmentId).toBeTruthy();
    expect(res.body.data.orderId).toBeTruthy();
    expect(res.body.data.courseId).toBe(ctx.paidCourseId);
  }, 30_000);

  it('9. Student A: Cannot purchase same course again', async () => {
    const res = await request(app)
      .post(`/api/v1/organizations/${ctx.orgId}/student/courses/${ctx.paidCourseId}/purchase`)
      .set('Cookie', ctx.studentACookie)
      .set('Origin', ORIGIN)
      .send({});
    
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ALREADY_ENROLLED');
  }, 30_000);

  it('10. Student A: Course overview now shows enrolled', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/courses/${ctx.paidCourseId}/overview`)
      .set('Cookie', ctx.studentACookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    expect(res.body.data.isEnrolled).toBe(true);
  }, 30_000);

  it('11. Student A: Search now shows paid course as enrolled', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/search`)
      .set('Cookie', ctx.studentACookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    const courses = res.body.data || [];
    
    const paidCourse = courses.find((c: { id: string }) => c.id === ctx.paidCourseId);
    const freeCourse = courses.find((c: { id: string }) => c.id === ctx.freeCourseId);
    
    expect(paidCourse).toBeTruthy();
    expect(paidCourse.isEnrolled).toBe(true); // ✅ Student A enrolled
    
    expect(freeCourse).toBeTruthy();
    expect(freeCourse.isEnrolled).toBe(false); // ✅ Student A NOT enrolled in free course
  }, 30_000);

  it('12. Student B: Search still shows both courses NOT enrolled', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/search`)
      .set('Cookie', ctx.studentBCookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    const courses = res.body.data || [];
    
    const paidCourse = courses.find((c: { id: string }) => c.id === ctx.paidCourseId);
    const freeCourse = courses.find((c: { id: string }) => c.id === ctx.freeCourseId);
    
    expect(paidCourse).toBeTruthy();
    expect(paidCourse.isEnrolled).toBe(false); // ✅ Student B NOT affected by Student A's enrollment
    
    expect(freeCourse).toBeTruthy();
    expect(freeCourse.isEnrolled).toBe(false);
  }, 30_000);

  it('13. Student B: Enroll in free course', async () => {
    const res = await request(app)
      .post(`/api/v1/organizations/${ctx.orgId}/enrollments/${ctx.freeCourseId}`)
      .set('Cookie', ctx.studentBCookie)
      .set('Origin', ORIGIN);
    
    expect(res.status, res.body?.error).toBe(201);
    expect(res.body.data.courseId).toBe(ctx.freeCourseId);
  }, 30_000);

  it('14. Student B: Search now shows free course enrolled, paid course NOT enrolled', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/search`)
      .set('Cookie', ctx.studentBCookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    const courses = res.body.data || [];
    
    const paidCourse = courses.find((c: { id: string }) => c.id === ctx.paidCourseId);
    const freeCourse = courses.find((c: { id: string }) => c.id === ctx.freeCourseId);
    
    expect(paidCourse).toBeTruthy();
    expect(paidCourse.isEnrolled).toBe(false); // ✅ Student B still NOT enrolled in paid course
    
    expect(freeCourse).toBeTruthy();
    expect(freeCourse.isEnrolled).toBe(true); // ✅ Student B enrolled in free course
  }, 30_000);

  it('15. Student A: Search shows different enrollment state than Student B', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/search`)
      .set('Cookie', ctx.studentACookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    const courses = res.body.data || [];
    
    const paidCourse = courses.find((c: { id: string }) => c.id === ctx.paidCourseId);
    const freeCourse = courses.find((c: { id: string }) => c.id === ctx.freeCourseId);
    
    expect(paidCourse).toBeTruthy();
    expect(paidCourse.isEnrolled).toBe(true); // ✅ Student A enrolled in paid course
    
    expect(freeCourse).toBeTruthy();
    expect(freeCourse.isEnrolled).toBe(false); // ✅ Student A NOT enrolled in free course
  }, 30_000);

  it('16. Student A: Can access enrolled paid course content', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/courses/${ctx.paidCourseId}`)
      .set('Cookie', ctx.studentACookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    expect(res.body.data.courseId).toBe(ctx.paidCourseId);
  }, 30_000);

  it('17. Student A: Cannot access non-enrolled free course content', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/courses/${ctx.freeCourseId}`)
      .set('Cookie', ctx.studentACookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('STUDENT_NOT_ENROLLED');
  }, 30_000);

  it('18. Student B: Can access enrolled free course content', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/courses/${ctx.freeCourseId}`)
      .set('Cookie', ctx.studentBCookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    expect(res.body.data.courseId).toBe(ctx.freeCourseId);
  }, 30_000);

  it('19. Student B: Cannot access non-enrolled paid course content', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/courses/${ctx.paidCourseId}`)
      .set('Cookie', ctx.studentBCookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('STUDENT_NOT_ENROLLED');
  }, 30_000);

  it('20. Logout/Login Persistence: Student A enrollment state persists', async () => {
    // Re-login Student A
    ctx.studentACookie = await loginUser(ctx.studentAEmail, ctx.studentAPassword);
    
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/search`)
      .set('Cookie', ctx.studentACookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    const courses = res.body.data || [];
    
    const paidCourse = courses.find((c: { id: string }) => c.id === ctx.paidCourseId);
    expect(paidCourse).toBeTruthy();
    expect(paidCourse.isEnrolled).toBe(true); // ✅ State persisted after login
  }, 30_000);

  it('21. Logout/Login Persistence: Student B enrollment state persists', async () => {
    // Re-login Student B
    ctx.studentBCookie = await loginUser(ctx.studentBEmail, ctx.studentBPassword);
    
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/search`)
      .set('Cookie', ctx.studentBCookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(200);
    const courses = res.body.data || [];
    
    const freeCourse = courses.find((c: { id: string }) => c.id === ctx.freeCourseId);
    const paidCourse = courses.find((c: { id: string }) => c.id === ctx.paidCourseId);
    
    expect(freeCourse).toBeTruthy();
    expect(freeCourse.isEnrolled).toBe(true); // ✅ Free course enrollment persisted
    
    expect(paidCourse).toBeTruthy();
    expect(paidCourse.isEnrolled).toBe(false); // ✅ Still not enrolled in paid course
  }, 30_000);

  it('22. Security: Cannot enroll in same free course twice', async () => {
    const res = await request(app)
      .post(`/api/v1/organizations/${ctx.orgId}/enrollments/${ctx.freeCourseId}`)
      .set('Cookie', ctx.studentBCookie)
      .set('Origin', ORIGIN);
    
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ALREADY_ENROLLED');
  }, 30_000);

  it('23. Final verification: Different students see different enrollment states', async () => {
    // Student A final check
    const resA = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/search`)
      .set('Cookie', ctx.studentACookie)
      .set('Origin', ORIGIN);
    
    expect(resA.status).toBe(200);
    const coursesA = resA.body.data || [];
    
    // Student B final check
    const resB = await request(app)
      .get(`/api/v1/organizations/${ctx.orgId}/student/search`)
      .set('Cookie', ctx.studentBCookie)
      .set('Origin', ORIGIN);
    
    expect(resB.status).toBe(200);
    const coursesB = resB.body.data || [];
    
    // Verify enrollment isolation
    const paidCourseA = coursesA.find((c: { id: string }) => c.id === ctx.paidCourseId);
    const paidCourseB = coursesB.find((c: { id: string }) => c.id === ctx.paidCourseId);
    const freeCourseA = coursesA.find((c: { id: string }) => c.id === ctx.freeCourseId);
    const freeCourseB = coursesB.find((c: { id: string }) => c.id === ctx.freeCourseId);
    
    // Student A: enrolled in paid, NOT in free
    expect(paidCourseA.isEnrolled).toBe(true);
    expect(freeCourseA.isEnrolled).toBe(false);
    
    // Student B: enrolled in free, NOT in paid
    expect(paidCourseB.isEnrolled).toBe(false);
    expect(freeCourseB.isEnrolled).toBe(true);
  }, 30_000);
});