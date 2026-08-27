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
    findMany: vi.fn(),
  },
  module: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  lesson: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
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

const now = new Date('2026-08-27T10:00:00.000Z');

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
    title: 'Intro to Testing',
    slug: 'intro-to-testing',
    description: 'Learn testing',
    thumbnailUrl: null,
    category: 'Development',
    price: null,
    discountPrice: null,
    status: 'PUBLISHED',
    publishedAt: now,
    estimatedMinutes: 120,
    difficulty: 'Beginner',
    learningObjectives: ['Write tests'],
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

function moduleRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'module-1',
    courseId: 'course-1',
    title: 'Module One',
    description: 'First module',
    order: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function lessonRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lesson-1',
    moduleId: 'module-1',
    title: 'Lesson One',
    description: 'First lesson',
    content: 'Lesson content here',
    type: 'Article',
    duration: 30,
    order: 0,
    isPreview: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

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

  prismaMock.userOrganization.findFirst.mockImplementation(async ({ where }: any) => {
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
  prismaMock.enrollment.findMany.mockReset();
  prismaMock.module.findMany.mockReset();
  prismaMock.module.findFirst.mockReset();
  prismaMock.lesson.findMany.mockReset();
  prismaMock.lesson.findFirst.mockReset();
  prismaMock.lesson.count.mockReset();
}

describe('GET /api/v1/organizations/:organizationId/student/courses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('rejects students with unverified email with 403', async () => {
    await authenticateAs('STUDENT', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses')
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
      .get('/api/v1/organizations/org-a/student/courses')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('rejects org admin with 403', async () => {
    await authenticateAs('ORG_ADMIN', { userId: 'admin-1' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ userId: 'admin-1', role: 'ORG_ADMIN' }),
    );

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('returns enrolled courses for an authenticated student', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findMany.mockResolvedValue([
      enrollmentRecord(),
    ]);
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      enrollmentId: 'enrollment-1',
      enrollmentStatus: 'ACTIVE',
      courseId: 'course-1',
      title: 'Intro to Testing',
    });
  });

  it('returns empty array when student has no enrollments', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('excludes enrollments from other organizations', async () => {
    await authenticateAs('STUDENT', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findMany.mockResolvedValue([
      enrollmentRecord({ organizationId: 'org-b', courseId: 'course-foreign' }),
    ]);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('rejects users whose membership belongs to another organization with 403', async () => {
    await authenticateAs('STUDENT', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-b/student/courses')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
  });
});

describe('GET /api/v1/organizations/:organizationId/student/courses/:courseId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('returns course detail with modules and lesson counts for enrolled student', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findMany.mockResolvedValue([moduleRecord()]);
    prismaMock.lesson.count.mockResolvedValue(3);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      enrollmentId: 'enrollment-1',
      enrollmentStatus: 'ACTIVE',
      courseId: 'course-1',
      title: 'Intro to Testing',
    });
    expect(res.body.data.modules).toHaveLength(1);
    expect(res.body.data.modules[0]).toMatchObject({
      id: 'module-1',
      title: 'Module One',
      lessonCount: 3,
    });
  });

  it('returns 403 when student is not enrolled in the course', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('STUDENT_NOT_ENROLLED');
  });

  it('returns 403 when enrollment belongs to another organization', async () => {
    await authenticateAs('STUDENT', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(
      enrollmentRecord({ organizationId: 'org-b' }),
    );

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('STUDENT_NOT_ENROLLED');
  });

  it('returns 404 when course does not exist', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/nonexistent')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
  });

  it('returns course with empty modules when course has no modules', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.data.modules).toEqual([]);
  });

  it('rejects non-student roles with 403', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ role: 'INSTRUCTOR' }),
    );

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });
});

describe('GET /api/v1/organizations/:organizationId/student/courses/:courseId/modules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/modules');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('returns modules with lesson counts for enrolled student', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findMany.mockResolvedValue([moduleRecord()]);
    prismaMock.lesson.count.mockResolvedValue(5);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/modules')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      courseId: 'course-1',
      courseName: 'Intro to Testing',
    });
    expect(res.body.data.modules).toHaveLength(1);
    expect(res.body.data.modules[0]).toMatchObject({
      id: 'module-1',
      title: 'Module One',
      lessonCount: 5,
    });
  });

  it('returns 403 when student is not enrolled', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/modules')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('STUDENT_NOT_ENROLLED');
  });

  it('returns 404 when course does not exist', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/nonexistent/modules')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
  });

  it('returns empty modules array when course has no modules', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/modules')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.data.modules).toEqual([]);
  });

  it('rejects non-student roles with 403', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ role: 'INSTRUCTOR' }),
    );

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/modules')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });
});

describe('GET /api/v1/organizations/:organizationId/student/courses/:courseId/modules/:moduleId/lessons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/modules/module-1/lessons');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('returns lessons for an enrolled student', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
    prismaMock.lesson.findMany.mockResolvedValue([lessonRecord()]);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/modules/module-1/lessons')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      moduleId: 'module-1',
      moduleTitle: 'Module One',
      courseId: 'course-1',
      courseName: 'Intro to Testing',
    });
    expect(res.body.data.lessons).toHaveLength(1);
    expect(res.body.data.lessons[0]).toMatchObject({
      id: 'lesson-1',
      title: 'Lesson One',
      type: 'Article',
      duration: 30,
    });
  });

  it('returns 403 when student is not enrolled', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/modules/module-1/lessons')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('STUDENT_NOT_ENROLLED');
  });

  it('returns 404 when course does not exist', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/nonexistent/modules/module-1/lessons')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
  });

  it('returns 404 when module does not exist in the course', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/modules/nonexistent/lessons')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('MODULE_NOT_FOUND');
  });

  it('returns empty lessons when module has no lessons', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
    prismaMock.lesson.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/modules/module-1/lessons')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.data.lessons).toEqual([]);
  });

  it('rejects non-student roles with 403', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ role: 'INSTRUCTOR' }),
    );

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/modules/module-1/lessons')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });
});

describe('GET /api/v1/organizations/:organizationId/student/courses/:courseId/modules/:moduleId/lessons/:lessonId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/modules/module-1/lessons/lesson-1');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('returns lesson content for an enrolled student', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
    prismaMock.lesson.findFirst.mockResolvedValue(lessonRecord());

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/modules/module-1/lessons/lesson-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      enrollmentVerified: true,
    });
    expect(res.body.data.lesson).toMatchObject({
      id: 'lesson-1',
      title: 'Lesson One',
      content: 'Lesson content here',
      type: 'Article',
      duration: 30,
    });
    expect(res.body.data.module).toMatchObject({
      id: 'module-1',
      title: 'Module One',
    });
    expect(res.body.data.course).toMatchObject({
      id: 'course-1',
      title: 'Intro to Testing',
    });
  });

  it('returns 403 when student is not enrolled', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/modules/module-1/lessons/lesson-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('STUDENT_NOT_ENROLLED');
  });

  it('returns 404 when course does not exist', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/nonexistent/modules/module-1/lessons/lesson-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
  });

  it('returns 404 when module does not exist', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/modules/nonexistent/lessons/lesson-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('MODULE_NOT_FOUND');
  });

  it('returns 404 when lesson does not exist in the module', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
    prismaMock.lesson.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/modules/module-1/lessons/nonexistent')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('LESSON_NOT_FOUND');
  });

  it('rejects non-student roles with 403', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ role: 'INSTRUCTOR' }),
    );

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/modules/module-1/lessons/lesson-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('prevents access to course from another organization', async () => {
    await authenticateAs('STUDENT', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(
      enrollmentRecord({ organizationId: 'org-b' }),
    );
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
    prismaMock.lesson.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/courses/course-1/modules/module-1/lessons/lesson-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('STUDENT_NOT_ENROLLED');
  });
});
