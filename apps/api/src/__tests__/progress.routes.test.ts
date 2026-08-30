import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  userOrganization: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
  },
  course: {
    findFirst: vi.fn(),
  },
  enrollment: {
    findUnique: vi.fn(),
  },
  module: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  lesson: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  lessonProgress: {
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
  courseProgress: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  quizAttempt: {
    findMany: vi.fn(),
  },
};

vi.mock('../services/authService', () => ({
  getSessionFromToken: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock('../prisma', () => ({
  default: () => prismaMock,
}));

import app from '../server';
import * as authService from '../services/authService';

const now = new Date('2026-08-28T10:00:00.000Z');

function membershipRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mem-1',
    userId: 'user-1',
    organizationId: 'org-a',
    role: 'STUDENT',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function courseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    organizationId: 'org-a',
    instructorUserId: 'instructor-1',
    title: 'Progress Course',
    slug: 'progress-course',
    description: null,
    thumbnailUrl: null,
    category: null,
    price: null,
    discountPrice: null,
    status: 'PUBLISHED',
    publishedAt: now,
    estimatedMinutes: null,
    difficulty: null,
    learningObjectives: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function enrollmentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'enrollment-1',
    userId: 'user-1',
    courseId: 'course-1',
    organizationId: 'org-a',
    status: 'ACTIVE',
    enrolledAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function moduleRecord(id: string, title: string, order: number) {
  return {
    id,
    courseId: 'course-1',
    title,
    description: null,
    order,
    createdAt: now,
    updatedAt: now,
  };
}

function lessonRecord(id: string, moduleId: string, title: string, order: number) {
  return {
    id,
    moduleId,
    courseId: 'course-1',
    title,
    description: null,
    order,
    createdAt: now,
    updatedAt: now,
  };
}

const MODULE_ONE = moduleRecord('module-1', 'Module One', 0);
const MODULE_TWO = moduleRecord('module-2', 'Module Two', 1);

async function authenticateAs(
  role: 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'INSTRUCTOR' | 'STUDENT',
  options?: {
    userId?: string;
    organizationId?: string;
    emailVerified?: boolean;
  },
) {
  const userId = options?.userId ?? 'user-1';
  const organizationId = options?.organizationId ?? 'org-a';
  const emailVerified = options?.emailVerified ?? true;

  vi.mocked(authService.getSessionFromToken).mockResolvedValue({
    id: 'session-1',
    userId,
    tokenHash: 'hash',
    expiresAt: new Date(Date.now() + 3600000),
    revoked: false,
    createdAt: now,
    updatedAt: now,
  });

  vi.mocked(authService.getUserById).mockResolvedValue({
    id: userId,
    name: 'Test User',
    email: `${role.toLowerCase()}@example.com`,
    passwordHash: 'hash',
    emailVerified,
    createdAt: now,
    updatedAt: now,
  });

  prismaMock.userOrganization.findMany.mockResolvedValue([
    { role, organizationId, userId },
  ]);

  prismaMock.userOrganization.findFirst.mockImplementation(async ({ where }: { where?: { role?: string; organizationId?: string; userId?: string; id?: string; courseId?: string; moduleId?: string; quizId?: string; status?: string } }) => {
    if (where?.role === 'PLATFORM_ADMIN') {
      return role === 'PLATFORM_ADMIN' ? { role, organizationId, userId } : null;
    }
    return null;
  });
}

function cookie() {
  return ['learnflow_session=valid-token'];
}

function resetMocks() {
  prismaMock.userOrganization.findMany.mockReset();
  prismaMock.userOrganization.findFirst.mockReset();
  prismaMock.userOrganization.findUnique.mockReset();
  prismaMock.organization.findUnique.mockReset();
  prismaMock.course.findFirst.mockReset();
  prismaMock.enrollment.findUnique.mockReset();
  prismaMock.module.findMany.mockReset();
  prismaMock.module.findFirst.mockReset();
  prismaMock.lesson.findMany.mockReset();
  prismaMock.lesson.findFirst.mockReset();
  prismaMock.lessonProgress.upsert.mockReset();
  prismaMock.lessonProgress.findMany.mockReset();
  prismaMock.courseProgress.upsert.mockReset();
  prismaMock.courseProgress.findUnique.mockReset();
  prismaMock.courseProgress.update.mockReset();
  prismaMock.quizAttempt.findMany.mockReset();
  vi.mocked(authService.getSessionFromToken).mockReset();
  vi.mocked(authService.getUserById).mockReset();
}

function setupProgressFixtures(
  options: {
    completedRows?: Array<{ lessonId: string; moduleId: string }>;
    attempts?: unknown[];
    courseProgress?: unknown | null;
  } = {},
) {
  prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
  prismaMock.course.findFirst.mockResolvedValue(courseRecord());
  prismaMock.module.findMany.mockResolvedValue([MODULE_ONE, MODULE_TWO]);
  prismaMock.lesson.findMany.mockImplementation(async ({ where }: { where?: { role?: string; organizationId?: string; userId?: string; id?: string; courseId?: string; moduleId?: string; quizId?: string; status?: string } }) => {
    if (where?.moduleId === 'module-1') {
      return [
        lessonRecord('lesson-1', 'module-1', 'Lesson One', 0),
        lessonRecord('lesson-2', 'module-1', 'Lesson Two', 1),
      ];
    }
    if (where?.moduleId === 'module-2') {
      return [
        lessonRecord('lesson-3', 'module-2', 'Lesson Three', 0),
        lessonRecord('lesson-4', 'module-2', 'Lesson Four', 1),
      ];
    }
    return [];
  });
  prismaMock.lessonProgress.findMany.mockResolvedValue(
    (options.completedRows ?? []).map((r) => ({ ...r, completedAt: now })),
  );
  prismaMock.quizAttempt.findMany.mockResolvedValue(options.attempts ?? []);
  prismaMock.courseProgress.findUnique.mockResolvedValue(options.courseProgress ?? null);
}

describe('GET /api/v1/organizations/:organizationId/student/courses/:courseId/progress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/organizations/org-a/student/courses/course-1/progress');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('rejects students with unverified email with 403', async () => {
    await authenticateAs('STUDENT', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/progress')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
  });

  it('rejects non-student roles with 403', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ role: 'INSTRUCTOR' }),
    );

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/progress')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('returns 403 for cross-tenant organization access', async () => {
    await authenticateAs('STUDENT', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-b/student/courses/course-foreign/progress')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
  });

  it('returns 403 when student is not enrolled in the course', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/progress')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('STUDENT_NOT_ENROLLED');
  });

  it('returns 403 when enrollment belongs to another organization', async () => {
    await authenticateAs('STUDENT', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(
      enrollmentRecord({ organizationId: 'org-b' }),
    );

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/progress')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('STUDENT_NOT_ENROLLED');
  });

  it('returns 404 when course does not exist', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/nonexistent/progress')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
  });

  it('calculates module and course progress server-side', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    setupProgressFixtures({ completedRows: [{ lessonId: 'lesson-1', moduleId: 'module-1' }] });

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/progress')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      courseId: 'course-1',
      totalLessons: 4,
      completedLessons: 1,
      coursePercentage: 25,
      courseComplete: false,
    });
    expect(res.body.data.modules).toHaveLength(2);
    expect(res.body.data.modules[0]).toMatchObject({
      id: 'module-1',
      lessonCount: 2,
      completedLessons: 1,
      percentage: 50,
      complete: false,
    });
    expect(res.body.data.modules[1]).toMatchObject({
      id: 'module-2',
      lessonCount: 2,
      completedLessons: 0,
      percentage: 0,
      complete: false,
    });
    expect(res.body.data.quizzes).toEqual([]);
  });

  it('reports 100% and course complete when all lessons are completed', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    setupProgressFixtures({
      completedRows: [
        { lessonId: 'lesson-1', moduleId: 'module-1' },
        { lessonId: 'lesson-2', moduleId: 'module-1' },
        { lessonId: 'lesson-3', moduleId: 'module-2' },
        { lessonId: 'lesson-4', moduleId: 'module-2' },
      ],
      courseProgress: {
        id: 'cp-1',
        userId: 'user-1',
        courseId: 'course-1',
        organizationId: 'org-a',
        completed: true,
        completedAt: now,
        lastVisitedModuleId: 'module-2',
        lastVisitedLessonId: 'lesson-4',
        lastVisitedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/progress')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      coursePercentage: 100,
      courseComplete: true,
      completedLessons: 4,
    });
    expect(res.body.data.lastVisited).toMatchObject({
      moduleId: 'module-2',
      lessonId: 'lesson-4',
    });
  });

  it('includes quiz attempt summary with best percentage', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    setupProgressFixtures({
      completedRows: [],
      attempts: [
        {
          id: 'a1',
          quizId: 'quiz-1',
          attemptNumber: 1,
          score: 1,
          percentage: 50,
          passed: false,
          submittedAt: now,
          quiz: { id: 'quiz-1', moduleId: 'module-1', title: 'Quiz One', passingPercentage: 70 },
        },
        {
          id: 'a2',
          quizId: 'quiz-1',
          attemptNumber: 2,
          score: 2,
          percentage: 100,
          passed: true,
          submittedAt: now,
          quiz: { id: 'quiz-1', moduleId: 'module-1', title: 'Quiz One', passingPercentage: 70 },
        },
      ],
    });

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/progress')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.data.quizzes).toHaveLength(1);
    expect(res.body.data.quizzes[0]).toMatchObject({
      quizId: 'quiz-1',
      attempts: 2,
      bestPercentage: 100,
      latestPercentage: 100,
      passed: true,
    });
  });
});

describe('POST /api/v1/organizations/:organizationId/student/courses/:courseId/modules/:moduleId/lessons/:lessonId/progress', () => {
  const POST_PATH =
    '/api/v1/organizations/org-a/student/courses/course-1/modules/module-1/lessons/lesson-1/progress';

  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).post(POST_PATH);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('rejects non-student roles with 403', async () => {
    await authenticateAs('ORG_ADMIN', { userId: 'admin-1' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ userId: 'admin-1', role: 'ORG_ADMIN' }),
    );

    const res = await request(app).post(POST_PATH).set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('returns 404 when lesson does not belong to the module', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(MODULE_ONE);
    prismaMock.lesson.findFirst.mockResolvedValue(null);

    const res = await request(app).post(POST_PATH).set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('LESSON_NOT_FOUND');
  });

  it('marks a lesson complete and upserts both progress records', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(MODULE_ONE);
    prismaMock.lesson.findFirst.mockResolvedValue(
      lessonRecord('lesson-1', 'module-1', 'Lesson One', 0),
    );

    prismaMock.lessonProgress.upsert.mockResolvedValue({
      id: 'lp-1',
      userId: 'user-1',
      lessonId: 'lesson-1',
      moduleId: 'module-1',
      courseId: 'course-1',
      organizationId: 'org-a',
      completed: true,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    prismaMock.courseProgress.upsert.mockResolvedValue({
      id: 'cp-1',
      userId: 'user-1',
      courseId: 'course-1',
      organizationId: 'org-a',
      lastVisitedModuleId: 'module-1',
      lastVisitedLessonId: 'lesson-1',
      lastVisitedAt: now,
      completed: false,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    setupProgressFixtures({ completedRows: [{ lessonId: 'lesson-1', moduleId: 'module-1' }] });

    const res = await request(app).post(POST_PATH).set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      lessonId: 'lesson-1',
      moduleId: 'module-1',
      courseId: 'course-1',
      completed: true,
    });

    expect(prismaMock.lessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_lessonId: { userId: 'user-1', lessonId: 'lesson-1' } },
        create: expect.objectContaining({
          userId: 'user-1',
          lessonId: 'lesson-1',
          moduleId: 'module-1',
          courseId: 'course-1',
          organizationId: 'org-a',
          completed: true,
        }),
      }),
    );
    expect(prismaMock.courseProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_courseId: { userId: 'user-1', courseId: 'course-1' } },
        update: expect.objectContaining({
          lastVisitedModuleId: 'module-1',
          lastVisitedLessonId: 'lesson-1',
        }),
      }),
    );
  });

  it('ignores a percentage sent by the frontend and computes progress server-side', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(MODULE_ONE);
    prismaMock.lesson.findFirst.mockResolvedValue(
      lessonRecord('lesson-1', 'module-1', 'Lesson One', 0),
    );
    prismaMock.lessonProgress.upsert.mockResolvedValue({ id: 'lp-1' });
    prismaMock.courseProgress.upsert.mockResolvedValue({ id: 'cp-1' });

    setupProgressFixtures({ completedRows: [{ lessonId: 'lesson-1', moduleId: 'module-1' }] });

    const res = await request(app)
      .post(POST_PATH)
      .set('Cookie', cookie())
      .send({ completed: true, percentage: 100, progress: 99 });

    expect(res.status).toBe(200);
    expect(res.body.data.courseProgress.coursePercentage).toBe(25);
    expect(res.body.data.courseProgress.courseComplete).toBe(false);
  });

  it('rejects a non-boolean completed field with 400 MISSING_FIELDS', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(MODULE_ONE);
    prismaMock.lesson.findFirst.mockResolvedValue(
      lessonRecord('lesson-1', 'module-1', 'Lesson One', 0),
    );

    const res = await request(app)
      .post(POST_PATH)
      .set('Cookie', cookie())
      .send({ completed: 'yes' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_FIELDS');
    expect(prismaMock.lessonProgress.upsert).not.toHaveBeenCalled();
  });

  it('allows unmarking a lesson as complete (completed: false)', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(MODULE_ONE);
    prismaMock.lesson.findFirst.mockResolvedValue(
      lessonRecord('lesson-1', 'module-1', 'Lesson One', 0),
    );
    prismaMock.lessonProgress.upsert.mockResolvedValue({ id: 'lp-1' });
    prismaMock.courseProgress.upsert.mockResolvedValue({ id: 'cp-1' });

    setupProgressFixtures({ completedRows: [] });

    const res = await request(app)
      .post(POST_PATH)
      .set('Cookie', cookie())
      .send({ completed: false });

    expect(res.status).toBe(200);
    expect(prismaMock.lessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ completed: false, completedAt: null }),
      }),
    );
  });
});
