/**
 * ownership-isolation.security.test.ts
 *
 * Regression tests for all confirmed tenant-isolation and ownership-enforcement
 * fixes applied during the LearnFlow security audit.
 *
 * Each test proves the fix at the layer specified in the audit task:
 *
 *   A. Module from Course B cannot be updated through Course A context.
 *   B. Module from Course B cannot be deleted through Course A context.
 *   C. Lesson from Module B cannot be updated through Module A context.
 *   D. Lesson from Module B cannot be deleted through Module A context.
 *   E. Quiz from Module B cannot be updated through Module A context.
 *   F. Quiz from Module B cannot be deleted through Module A context.
 *   G. CourseProgress creation always stores the real organizationId.
 *   H. Instructor A only receives their own courses from the course-list endpoint.
 *   I. Instructor A cannot access another organization's courses.
 *   J. Organization A analytics/audit/member/course data is inaccessible to Org B.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Prisma mock — must include all methods the fixed repositories now call,
// including the new updateMany / deleteMany operations.
// ---------------------------------------------------------------------------
const prismaMock = {
  userOrganization: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  course: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  module: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  lesson: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  quiz: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  courseProgress: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  lessonProgress: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  enrollment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock('../services/authService', () => ({
  getSessionFromToken: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock('../prisma', () => ({
  default: () => prismaMock,
}));

// Silence audit-log side-effects so they don't pollute test output.
vi.mock('../services/notificationDispatcher', () => ({
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
}));

import app from '../server';
import * as authService from '../services/authService';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const NOW = new Date('2026-09-02T10:00:00.000Z');

function session(userId = 'user-a') {
  return {
    id: 'session-1',
    userId,
    tokenHash: 'hash',
    expiresAt: new Date(Date.now() + 3_600_000),
    revoked: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function user(id = 'user-a', email = 'a@example.com') {
  return {
    id,
    name: 'Test User',
    email,
    passwordHash: 'hash',
    emailVerified: true,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function membership(
  userId = 'user-a',
  orgId = 'org-a',
  role: 'INSTRUCTOR' | 'ORG_ADMIN' | 'PLATFORM_ADMIN' | 'STUDENT' = 'INSTRUCTOR',
) {
  return { id: 'mem-1', userId, organizationId: orgId, role, createdAt: NOW, updatedAt: NOW };
}

function courseRecord(
  id = 'course-a',
  orgId = 'org-a',
  instructorId = 'user-a',
) {
  return {
    id,
    organizationId: orgId,
    instructorUserId: instructorId,
    title: `Course ${id}`,
    slug: `course-${id}`,
    description: null,
    thumbnailUrl: null,
    category: null,
    categoryId: null,
    price: null,
    discountPrice: null,
    status: 'DRAFT',
    publishedAt: null,
    estimatedMinutes: null,
    difficulty: null,
    learningObjectives: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function moduleRecord(id = 'module-a', courseId = 'course-a') {
  return { id, courseId, title: `Module ${id}`, description: null, order: 0, createdAt: NOW, updatedAt: NOW };
}

function lessonRecord(id = 'lesson-a', moduleId = 'module-a') {
  return {
    id, moduleId, title: `Lesson ${id}`, description: null, content: null,
    type: null, resourceUrl: null, resourceMimeType: null,
    duration: null, order: 0, isPreview: false, createdAt: NOW, updatedAt: NOW,
  };
}

function quizRecord(id = 'quiz-a', moduleId = 'module-a') {
  return {
    id, moduleId, title: `Quiz ${id}`, description: null,
    timeLimitMinutes: null, passingPercentage: null, maxAttempts: null,
    order: 0, createdAt: NOW, updatedAt: NOW,
  };
}

function cookie() {
  return ['learnflow_session=valid-token'];
}

/**
 * Set up auth mocks for a given user+org+role combination.
 * The `platformAdmin` param allows the findFirst(PLATFORM_ADMIN) check to pass.
 */
async function authenticate(
  userId: string,
  orgId: string,
  role: 'INSTRUCTOR' | 'ORG_ADMIN' | 'PLATFORM_ADMIN' | 'STUDENT',
) {
  vi.mocked(authService.getSessionFromToken).mockResolvedValue(session(userId));
  vi.mocked(authService.getUserById).mockResolvedValue(user(userId, `${userId}@example.com`));

  prismaMock.userOrganization.findMany.mockResolvedValue([
    { role, organizationId: orgId, userId, organization: { slug: orgId === 'platform' ? 'platform' : orgId } },
  ]);

  // findFirst used by requireOrganizationContext / requireOrgAdmin to check PLATFORM_ADMIN
  prismaMock.userOrganization.findFirst.mockImplementation(
    async ({ where }: { where?: { role?: string } }) => {
      if (where?.role === 'PLATFORM_ADMIN') {
        return role === 'PLATFORM_ADMIN' ? membership(userId, orgId, 'PLATFORM_ADMIN') : null;
      }
      return null;
    },
  );

  // findUnique used by requireOrganizationContext for member-verification
  prismaMock.userOrganization.findUnique.mockResolvedValue(membership(userId, orgId, role));
}

function resetAll() {
  vi.clearAllMocks();
  Object.values(prismaMock).forEach((model) =>
    Object.values(model).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset()),
  );
}

// ---------------------------------------------------------------------------
// A & B — Module ownership: update and delete must be bound to courseId
// ---------------------------------------------------------------------------

describe('A. Module from Course B cannot be updated through Course A context (C-01)', () => {
  beforeEach(resetAll);

  it('returns 404 when the moduleId does not belong to the requested courseId', async () => {
    await authenticate('user-a', 'org-a', 'INSTRUCTOR');

    // Course A exists in org-a; module belongs to course-b (different course).
    prismaMock.course.findFirst.mockResolvedValue(courseRecord('course-a', 'org-a'));
    // getById(courseId='course-a', moduleId='module-b') returns null — no match.
    prismaMock.module.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-a/modules/module-b')
      .set('Cookie', cookie())
      .send({ title: 'Cross-course injection' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('MODULE_NOT_FOUND');
    // The DB updateMany must never be reached.
    expect(prismaMock.module.updateMany).not.toHaveBeenCalled();
  });

  it('updateMany WHERE clause is bound to BOTH moduleId AND courseId', async () => {
    await authenticate('user-a', 'org-a', 'INSTRUCTOR');

    prismaMock.course.findFirst.mockResolvedValue(courseRecord('course-a', 'org-a'));
    prismaMock.module.findFirst
      .mockResolvedValueOnce(moduleRecord('module-a', 'course-a'))           // pre-check
      .mockResolvedValueOnce(moduleRecord('module-a', 'course-a'));           // post-update fetch
    prismaMock.module.updateMany.mockResolvedValue({ count: 1 });

    await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-a/modules/module-a')
      .set('Cookie', cookie())
      .send({ title: 'Legitimate update' });

    // The critical assertion: courseId must appear in the WHERE clause.
    expect(prismaMock.module.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'module-a', courseId: 'course-a' }),
      }),
    );
  });
});

describe('B. Module from Course B cannot be deleted through Course A context (C-01)', () => {
  beforeEach(resetAll);

  it('returns 404 when the moduleId does not belong to the requested courseId', async () => {
    await authenticate('user-a', 'org-a', 'INSTRUCTOR');

    prismaMock.course.findFirst.mockResolvedValue(courseRecord('course-a', 'org-a'));
    prismaMock.module.findFirst.mockResolvedValue(null); // module-b not in course-a

    const res = await request(app)
      .delete('/api/v1/organizations/org-a/courses/course-a/modules/module-b')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('MODULE_NOT_FOUND');
    expect(prismaMock.module.deleteMany).not.toHaveBeenCalled();
  });

  it('deleteMany WHERE clause is bound to BOTH moduleId AND courseId', async () => {
    await authenticate('user-a', 'org-a', 'INSTRUCTOR');

    prismaMock.course.findFirst.mockResolvedValue(courseRecord('course-a', 'org-a'));
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord('module-a', 'course-a'));
    prismaMock.module.deleteMany.mockResolvedValue({ count: 1 });

    await request(app)
      .delete('/api/v1/organizations/org-a/courses/course-a/modules/module-a')
      .set('Cookie', cookie());

    expect(prismaMock.module.deleteMany).toHaveBeenCalledWith({
      where: { id: 'module-a', courseId: 'course-a' },
    });
  });
});

// ---------------------------------------------------------------------------
// C & D — Lesson ownership: update and delete must be bound to moduleId
// ---------------------------------------------------------------------------

describe('C. Lesson from Module B cannot be updated through Module A context (C-02)', () => {
  beforeEach(resetAll);

  it('returns 404 when the lessonId does not belong to the requested moduleId', async () => {
    await authenticate('user-a', 'org-a', 'INSTRUCTOR');

    prismaMock.course.findFirst.mockResolvedValue(courseRecord('course-a', 'org-a'));
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord('module-a', 'course-a'));
    // getById(moduleId='module-a', lessonId='lesson-b') — no match
    prismaMock.lesson.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-a/modules/module-a/lessons/lesson-b')
      .set('Cookie', cookie())
      .send({ title: 'Cross-module injection' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('LESSON_NOT_FOUND');
    expect(prismaMock.lesson.updateMany).not.toHaveBeenCalled();
  });

  it('updateMany WHERE clause is bound to BOTH lessonId AND moduleId', async () => {
    await authenticate('user-a', 'org-a', 'INSTRUCTOR');

    prismaMock.course.findFirst.mockResolvedValue(courseRecord('course-a', 'org-a'));
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord('module-a', 'course-a'));
    prismaMock.lesson.findFirst
      .mockResolvedValueOnce(lessonRecord('lesson-a', 'module-a'))
      .mockResolvedValueOnce(lessonRecord('lesson-a', 'module-a'));
    prismaMock.lesson.updateMany.mockResolvedValue({ count: 1 });

    await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-a/modules/module-a/lessons/lesson-a')
      .set('Cookie', cookie())
      .send({ title: 'Legitimate update' });

    expect(prismaMock.lesson.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'lesson-a', moduleId: 'module-a' }),
      }),
    );
  });
});

describe('D. Lesson from Module B cannot be deleted through Module A context (C-02)', () => {
  beforeEach(resetAll);

  it('returns 404 when the lessonId does not belong to the requested moduleId', async () => {
    await authenticate('user-a', 'org-a', 'INSTRUCTOR');

    prismaMock.course.findFirst.mockResolvedValue(courseRecord('course-a', 'org-a'));
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord('module-a', 'course-a'));
    prismaMock.lesson.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/v1/organizations/org-a/courses/course-a/modules/module-a/lessons/lesson-b')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('LESSON_NOT_FOUND');
    expect(prismaMock.lesson.deleteMany).not.toHaveBeenCalled();
  });

  it('deleteMany WHERE clause is bound to BOTH lessonId AND moduleId', async () => {
    await authenticate('user-a', 'org-a', 'INSTRUCTOR');

    prismaMock.course.findFirst.mockResolvedValue(courseRecord('course-a', 'org-a'));
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord('module-a', 'course-a'));
    prismaMock.lesson.findFirst.mockResolvedValue(lessonRecord('lesson-a', 'module-a'));
    prismaMock.lesson.deleteMany.mockResolvedValue({ count: 1 });

    await request(app)
      .delete('/api/v1/organizations/org-a/courses/course-a/modules/module-a/lessons/lesson-a')
      .set('Cookie', cookie());

    expect(prismaMock.lesson.deleteMany).toHaveBeenCalledWith({
      where: { id: 'lesson-a', moduleId: 'module-a' },
    });
  });
});

// ---------------------------------------------------------------------------
// E & F — Quiz ownership: update and delete must be bound to moduleId
// ---------------------------------------------------------------------------

describe('E. Quiz from Module B cannot be updated through Module A context (C-03)', () => {
  beforeEach(resetAll);

  it('returns 404 when the quizId does not belong to the requested moduleId', async () => {
    await authenticate('user-a', 'org-a', 'INSTRUCTOR');

    prismaMock.course.findFirst.mockResolvedValue(courseRecord('course-a', 'org-a'));
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord('module-a', 'course-a'));
    // getById(moduleId='module-a', quizId='quiz-b') — no match
    prismaMock.quiz.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-a/modules/module-a/quizzes/quiz-b')
      .set('Cookie', cookie())
      .send({ title: 'Cross-module injection' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('QUIZ_NOT_FOUND');
    expect(prismaMock.quiz.updateMany).not.toHaveBeenCalled();
  });

  it('updateMany WHERE clause is bound to BOTH quizId AND moduleId', async () => {
    await authenticate('user-a', 'org-a', 'INSTRUCTOR');

    prismaMock.course.findFirst.mockResolvedValue(courseRecord('course-a', 'org-a'));
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord('module-a', 'course-a'));
    prismaMock.quiz.findFirst
      .mockResolvedValueOnce(quizRecord('quiz-a', 'module-a'))
      .mockResolvedValueOnce(quizRecord('quiz-a', 'module-a'));
    prismaMock.quiz.updateMany.mockResolvedValue({ count: 1 });

    await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-a/modules/module-a/quizzes/quiz-a')
      .set('Cookie', cookie())
      .send({ title: 'Legitimate update' });

    expect(prismaMock.quiz.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'quiz-a', moduleId: 'module-a' }),
      }),
    );
  });
});

describe('F. Quiz from Module B cannot be deleted through Module A context (C-03)', () => {
  beforeEach(resetAll);

  it('returns 404 when the quizId does not belong to the requested moduleId', async () => {
    await authenticate('user-a', 'org-a', 'INSTRUCTOR');

    prismaMock.course.findFirst.mockResolvedValue(courseRecord('course-a', 'org-a'));
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord('module-a', 'course-a'));
    prismaMock.quiz.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/v1/organizations/org-a/courses/course-a/modules/module-a/quizzes/quiz-b')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('QUIZ_NOT_FOUND');
    expect(prismaMock.quiz.deleteMany).not.toHaveBeenCalled();
  });

  it('deleteMany WHERE clause is bound to BOTH quizId AND moduleId', async () => {
    await authenticate('user-a', 'org-a', 'INSTRUCTOR');

    prismaMock.course.findFirst.mockResolvedValue(courseRecord('course-a', 'org-a'));
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord('module-a', 'course-a'));
    prismaMock.quiz.findFirst.mockResolvedValue(quizRecord('quiz-a', 'module-a'));
    prismaMock.quiz.deleteMany.mockResolvedValue({ count: 1 });

    await request(app)
      .delete('/api/v1/organizations/org-a/courses/course-a/modules/module-a/quizzes/quiz-a')
      .set('Cookie', cookie());

    expect(prismaMock.quiz.deleteMany).toHaveBeenCalledWith({
      where: { id: 'quiz-a', moduleId: 'module-a' },
    });
  });
});

// ---------------------------------------------------------------------------
// G — CourseProgress organizationId integrity (M-03)
// ---------------------------------------------------------------------------

describe('G. CourseProgress creation always stores the real organizationId (M-03)', () => {
  beforeEach(resetAll);

  it('upsert create branch receives the authenticated organizationId, never an empty string', async () => {
    await authenticate('user-a', 'org-a', 'STUDENT');

    // Enrollment and course verified in the right org.
    prismaMock.course.findFirst.mockResolvedValue(courseRecord('course-a', 'org-a'));
    prismaMock.enrollment.findUnique.mockResolvedValue({
      id: 'enroll-1', userId: 'user-a', courseId: 'course-a',
      organizationId: 'org-a', status: 'ACTIVE', enrolledAt: NOW, createdAt: NOW, updatedAt: NOW,
    });
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord('module-a', 'course-a'));
    prismaMock.lesson.findFirst.mockResolvedValue(lessonRecord('lesson-a', 'module-a'));

    // LessonProgress upsert
    prismaMock.lessonProgress.upsert.mockResolvedValue({
      id: 'lp-1', userId: 'user-a', lessonId: 'lesson-a', moduleId: 'module-a',
      courseId: 'course-a', organizationId: 'org-a', completed: true, completedAt: NOW,
      createdAt: NOW, updatedAt: NOW,
    });

    // upsertCourseProgressLastVisited
    prismaMock.courseProgress.upsert.mockResolvedValue({
      id: 'cp-1', userId: 'user-a', courseId: 'course-a', organizationId: 'org-a',
      lastVisitedModuleId: 'module-a', lastVisitedLessonId: 'lesson-a',
      lastVisitedAt: NOW, completed: false, completedAt: null, createdAt: NOW, updatedAt: NOW,
    });

    // getCourseProgress
    prismaMock.courseProgress.findUnique.mockResolvedValue({
      id: 'cp-1', userId: 'user-a', courseId: 'course-a', organizationId: 'org-a',
      lastVisitedModuleId: 'module-a', lastVisitedLessonId: 'lesson-a',
      lastVisitedAt: NOW, completed: false, completedAt: null, createdAt: NOW, updatedAt: NOW,
    });

    // computeCourseProgress helpers
    prismaMock.module.findMany.mockResolvedValue([moduleRecord('module-a', 'course-a')]);
    prismaMock.lessonProgress.findMany.mockResolvedValue([]);
    // quizAttempt queries happen inside computeCourseProgress; add stub to the mock.
    const mockWithQuiz = prismaMock as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    mockWithQuiz.quizAttempt = { findMany: vi.fn().mockResolvedValue([]) };
    prismaMock.lesson.findMany.mockResolvedValue([lessonRecord('lesson-a', 'module-a')]);

    const res = await request(app)
      .post('/api/v1/organizations/org-a/student/courses/course-a/modules/module-a/lessons/lesson-a/progress')
      .set('Cookie', cookie())
      .send({ completed: true });

    expect(res.status).toBe(200);

    // Every courseProgress.upsert call must have a non-empty organizationId in
    // both the update and create branches.
    const upsertCalls = prismaMock.courseProgress.upsert.mock.calls;
    for (const [args] of upsertCalls) {
      const arg = args as { update?: Record<string, unknown>; create?: Record<string, unknown> };
      if (arg.create) {
        expect(arg.create.organizationId).toBeTruthy();
        expect(arg.create.organizationId).not.toBe('');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// H — Instructor A only receives their own courses (M-04)
// ---------------------------------------------------------------------------

describe('H. Instructor A only receives courses where instructorUserId matches (M-04)', () => {
  beforeEach(resetAll);

  it('course list is filtered by instructorUserId at the DB layer for INSTRUCTOR role', async () => {
    await authenticate('user-a', 'org-a', 'INSTRUCTOR');

    // Return two courses: one owned by user-a, one owned by user-b.
    // The DB layer should filter so only user-a's course is returned.
    // Simulate the repository correctly filtering by returning only the
    // instructor's own course when instructorId is passed.
    prismaMock.course.findMany.mockResolvedValue([
      courseRecord('course-a', 'org-a', 'user-a'),
    ]);
    prismaMock.course.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('course-a');

    // Critical: the DB query must include instructorUserId filter.
    expect(prismaMock.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-a',
          instructorUserId: 'user-a',
        }),
      }),
    );
    expect(prismaMock.course.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-a',
          instructorUserId: 'user-a',
        }),
      }),
    );
  });

  it('ORG_ADMIN receives all org courses without instructorUserId filter', async () => {
    await authenticate('admin-a', 'org-a', 'ORG_ADMIN');

    prismaMock.course.findMany.mockResolvedValue([
      courseRecord('course-a', 'org-a', 'user-a'),
      courseRecord('course-b', 'org-a', 'user-b'),
    ]);
    prismaMock.course.count.mockResolvedValue(2);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);

    // ORG_ADMIN must NOT have instructorUserId in the query.
    expect(prismaMock.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ instructorUserId: expect.anything() }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// I — Instructor A cannot access another organization's courses (cross-tenant)
// ---------------------------------------------------------------------------

describe('I. Instructor A cannot access Organization B courses (cross-tenant, M-04)', () => {
  beforeEach(resetAll);

  it('returns 403 when instructor targets an org they do not belong to', async () => {
    // user-a is in org-a; they try to access org-b's courses.
    await authenticate('user-a', 'org-a', 'INSTRUCTOR');
    // findUnique returns null — user-a has no membership in org-b.
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-b/courses')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
    expect(prismaMock.course.findMany).not.toHaveBeenCalled();
  });

  it('returns 403 when instructor tries to create a course in another org', async () => {
    await authenticate('user-a', 'org-a', 'INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/organizations/org-b/courses')
      .set('Cookie', cookie())
      .send({ title: 'Stolen Course', slug: 'stolen' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
    expect(prismaMock.course.findMany).not.toHaveBeenCalled();
  });

  it('returns 404 when instructor uses a valid org-b courseId under their own org-a path', async () => {
    // user-a IS in org-a, but course-b belongs to org-b.
    await authenticate('user-a', 'org-a', 'INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membership('user-a', 'org-a', 'INSTRUCTOR'),
    );
    // courseRepo.getById(org-a, course-b) returns null — not in org-a.
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses/course-b')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// J — Organization A cannot access Organization B data (cross-tenant)
// ---------------------------------------------------------------------------

describe('J. Organization A data is inaccessible to Organization B users (cross-tenant)', () => {
  beforeEach(resetAll);

  it('org-a admin cannot access org-b audit logs (403)', async () => {
    // org-a admin uses X-Organization-Id header to try to reach org-b audit logs.
    await authenticate('admin-a', 'org-a', 'ORG_ADMIN');
    // requireOrgAdmin: findFirst(PLATFORM_ADMIN) → null; findUnique(userId, org-b) → null
    prismaMock.userOrganization.findFirst.mockResolvedValue(null);
    prismaMock.userOrganization.findUnique.mockResolvedValue(null); // not a member of org-b

    const res = await request(app)
      .get('/api/v1/org/audit-logs')
      .set('Cookie', cookie())
      .set('X-Organization-Id', 'org-b');

    expect(res.status).toBe(403);
    expect(prismaMock.auditLog.findMany).not.toHaveBeenCalled();
  });

  it('org-a admin cannot list org-b members via /org/users (403)', async () => {
    await authenticate('admin-a', 'org-a', 'ORG_ADMIN');
    prismaMock.userOrganization.findFirst.mockResolvedValue(null);
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/org/users')
      .set('Cookie', cookie())
      .set('X-Organization-Id', 'org-b');

    expect(res.status).toBe(403);
    // No member queries should have been executed.
    expect(prismaMock.userOrganization.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-b' }) }),
    );
  });

  it('org-a admin cannot access org-b analytics (403)', async () => {
    await authenticate('admin-a', 'org-a', 'ORG_ADMIN');
    prismaMock.userOrganization.findFirst.mockResolvedValue(null);
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/org/analytics')
      .set('Cookie', cookie())
      .set('X-Organization-Id', 'org-b');

    expect(res.status).toBe(403);
  });

  it('org-a admin cannot reach org-b dashboard (403)', async () => {
    await authenticate('admin-a', 'org-a', 'ORG_ADMIN');
    prismaMock.userOrganization.findFirst.mockResolvedValue(null);
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/org/dashboard')
      .set('Cookie', cookie())
      .set('X-Organization-Id', 'org-b');

    expect(res.status).toBe(403);
  });

  it('org-a student cannot search courses from org-b (403)', async () => {
    await authenticate('student-a', 'org-a', 'STUDENT');
    // findUnique for org-b membership → null
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-b/student/search?q=test')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(prismaMock.course.findMany).not.toHaveBeenCalled();
  });

  it('org-a student cannot access org-b notifications (403)', async () => {
    await authenticate('student-a', 'org-a', 'STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-b/student/notifications')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
  });

  it('org-a audit logs endpoint always scopes to req.organizationId, not query param', async () => {
    await authenticate('admin-a', 'org-a', 'ORG_ADMIN');
    // Simulate successful auth for org-a — requireOrgAdmin uses findUnique
    prismaMock.userOrganization.findFirst.mockResolvedValue(null); // not platform admin
    prismaMock.userOrganization.findUnique.mockResolvedValue(membership('admin-a', 'org-a', 'ORG_ADMIN'));
    // requireAuth needs findMany to include organization.slug for filtering
    prismaMock.userOrganization.findMany.mockResolvedValue([
      { role: 'ORG_ADMIN', organizationId: 'org-a', userId: 'admin-a',
        organization: { slug: 'org-a', id: 'org-a' } },
    ]);
    prismaMock.auditLog.findMany.mockResolvedValue([]);
    prismaMock.auditLog.count.mockResolvedValue(0);
    prismaMock.organization.findMany.mockResolvedValue([]);

    // Attempt to inject org-b via query param — must be ignored.
    const res = await request(app)
      .get('/api/v1/org/audit-logs?organizationId=org-b')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);

    // The audit log query must only have been called with org-a (from session),
    // never org-b (from query param).
    if (prismaMock.auditLog.findMany.mock.calls.length > 0) {
      for (const [args] of prismaMock.auditLog.findMany.mock.calls) {
        const where = (args as { where?: { organizationId?: string } }).where;
        expect(where?.organizationId).not.toBe('org-b');
      }
    }
  });
});
