import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

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
  module: {
    findFirst: vi.fn(),
  },
  lesson: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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

const now = new Date('2026-08-25T10:00:00.000Z');

function membershipRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mem-1',
    userId: 'user-1',
    organizationId: 'org-a',
    role: 'INSTRUCTOR',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function courseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    organizationId: 'org-a',
    instructorUserId: 'user-1',
    title: 'Intro to Testing',
    slug: 'intro-to-testing',
    description: null,
    thumbnailUrl: null,
    category: null,
    price: null,
    discountPrice: null,
    status: 'DRAFT',
    publishedAt: null,
    estimatedMinutes: null,
    difficulty: null,
    learningObjectives: [],
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
    content: null,
    type: null,
    duration: null,
    order: 0,
    isPreview: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function lessonListItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lesson-1',
    title: 'Lesson One',
    description: 'First lesson',
    type: null,
    duration: null,
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
  prismaMock.module.findFirst.mockReset();
  prismaMock.lesson.create.mockReset();
  prismaMock.lesson.findMany.mockReset();
  prismaMock.lesson.findFirst.mockReset();
  prismaMock.lesson.update.mockReset();
  prismaMock.lesson.delete.mockReset();
}

const BASE = '/api/v1/organizations/org-a/courses/course-1/modules/module-1/lessons';

function setValidAuth(
  role: 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'INSTRUCTOR' | 'STUDENT' = 'INSTRUCTOR',
  options?: { userId?: string; organizationId?: string; emailVerified?: boolean },
) {
  const membershipOpts = options
    ? { role, organizationId: options.organizationId ?? 'org-a', userId: options.userId ?? 'user-1' }
    : { role, organizationId: 'org-a', userId: 'user-1' };

  return authenticateAs(role, options).then(() => {
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord(membershipOpts),
    );
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
  });
}

// ─── POST create lesson ────────────────────────────────────────────────

describe('POST /api/v1/organizations/:orgId/courses/:courseId/modules/:moduleId/lessons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post(BASE)
      .send({ title: 'Lesson One', order: 0 });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
    expect(prismaMock.lesson.create).not.toHaveBeenCalled();
  });

  it('rejects instructors with unverified email with 403', async () => {
    await authenticateAs('INSTRUCTOR', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Lesson One', order: 0 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
    expect(prismaMock.lesson.create).not.toHaveBeenCalled();
  });

  it('rejects students with 403', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({ role: 'STUDENT' }));
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Lesson One', order: 0 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
    expect(prismaMock.lesson.create).not.toHaveBeenCalled();
  });

  it('creates a lesson for an authorized instructor', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.lesson.create.mockImplementation(async ({ data }: { data?: Record<string, unknown> }) =>
      lessonRecord({ id: 'lesson-1', ...data, createdAt: now, updatedAt: now }),
    );

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Lesson One', order: 0 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: 'lesson-1',
      moduleId: 'module-1',
      title: 'Lesson One',
      order: 0,
    });
    expect(prismaMock.lesson.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        moduleId: 'module-1',
        title: 'Lesson One',
        order: 0,
      }),
    }));
  });

  it('creates a lesson for an authorized organization admin', async () => {
    await authenticateAs('ORG_ADMIN', { userId: 'admin-1' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ userId: 'admin-1', role: 'ORG_ADMIN' }),
    );
    prismaMock.course.findFirst.mockResolvedValue(
      courseRecord({ instructorUserId: 'admin-1' }),
    );
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
    prismaMock.lesson.create.mockImplementation(async ({ data }: { data?: Record<string, unknown> }) =>
      lessonRecord({ id: 'lesson-2', ...data, createdAt: now, updatedAt: now }),
    );

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Admin Lesson', order: 0, description: 'Desc' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Admin Lesson');
  });

  it('rejects when module does not exist with 404', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.module.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Lesson One', order: 0 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('MODULE_NOT_FOUND');
    expect(prismaMock.lesson.create).not.toHaveBeenCalled();
  });

  it('rejects when course does not exist in organization with 404', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Lesson One', order: 0 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
    expect(prismaMock.lesson.create).not.toHaveBeenCalled();
  });

  it('rejects users whose membership belongs to another organization with 403', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/organizations/org-b/courses/course-1/modules/module-1/lessons')
      .set('Cookie', cookie())
      .send({ title: 'Foreign Lesson', order: 0 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
    expect(prismaMock.lesson.create).not.toHaveBeenCalled();
  });

  it('returns 400 when title is missing or blank', async () => {
    await setValidAuth('INSTRUCTOR');

    const missing = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ order: 0 });

    const blank = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: '   ', order: 0 });

    expect(missing.status).toBe(400);
    expect(missing.body.success).toBe(false);
    expect(missing.body.error).toBe('MISSING_FIELDS');
    expect(blank.status).toBe(400);
    expect(blank.body.error).toBe('MISSING_FIELDS');
    expect(prismaMock.lesson.create).not.toHaveBeenCalled();
  });

  it('returns 400 when order is missing', async () => {
    await setValidAuth('INSTRUCTOR');

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Lesson Without Order' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_FIELDS');
    expect(prismaMock.lesson.create).not.toHaveBeenCalled();
  });

  it('returns 400 when order is not a valid non-negative integer', async () => {
    await setValidAuth('INSTRUCTOR');

    const negative = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Lesson', order: -1 });

    const nonInteger = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Lesson', order: 1.5 });

    expect(negative.status).toBe(400);
    expect(negative.body.error).toBe('INVALID_ORDER');
    expect(nonInteger.status).toBe(400);
    expect(nonInteger.body.error).toBe('INVALID_ORDER');
    expect(prismaMock.lesson.create).not.toHaveBeenCalled();
  });

  it('returns 400 when duration is negative', async () => {
    await setValidAuth('INSTRUCTOR');

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Lesson', order: 0, duration: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_DURATION');
    expect(prismaMock.lesson.create).not.toHaveBeenCalled();
  });

  it('returns 400 when duration is not a valid integer', async () => {
    await setValidAuth('INSTRUCTOR');

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Lesson', order: 0, duration: 3.5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_DURATION');
    expect(prismaMock.lesson.create).not.toHaveBeenCalled();
  });

  it('maps duplicate order within the same module to 409', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.lesson.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '4.16.2',
      }),
    );

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Duplicate Order', order: 0 });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('LESSON_ORDER_TAKEN');
  });
});

// ─── GET list lessons ──────────────────────────────────────────────────

describe('GET /api/v1/organizations/:orgId/courses/:courseId/modules/:moduleId/lessons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get(BASE);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
    expect(prismaMock.lesson.findMany).not.toHaveBeenCalled();
  });

  it('rejects instructors with unverified email with 403', async () => {
    await authenticateAs('INSTRUCTOR', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());

    const res = await request(app)
      .get(BASE)
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
    expect(prismaMock.lesson.findMany).not.toHaveBeenCalled();
  });

  it('rejects students with 403', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({ role: 'STUDENT' }));
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());

    const res = await request(app)
      .get(BASE)
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
    expect(prismaMock.lesson.findMany).not.toHaveBeenCalled();
  });

  it('returns lessons for an authorized instructor', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.lesson.findMany.mockResolvedValue([
      lessonListItem({ id: 'lesson-1', title: 'Lesson One', order: 0 }),
      lessonListItem({ id: 'lesson-2', title: 'Lesson Two', order: 1 }),
    ]);

    const res = await request(app)
      .get(BASE)
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      id: 'lesson-1',
      title: 'Lesson One',
      order: 0,
    });
    expect(res.body.data[1]).toMatchObject({
      id: 'lesson-2',
      title: 'Lesson Two',
      order: 1,
    });
    expect(prismaMock.lesson.findMany).toHaveBeenCalledWith({
      where: { moduleId: 'module-1' },
      select: expect.objectContaining({
        id: true,
        title: true,
        description: true,
        type: true,
        duration: true,
        order: true,
        isPreview: true,
        createdAt: true,
        updatedAt: true,
      }),
      orderBy: { order: 'asc' },
    });
  });

  it('returns lessons for an authorized organization admin', async () => {
    await authenticateAs('ORG_ADMIN', { userId: 'admin-1' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ userId: 'admin-1', role: 'ORG_ADMIN' }),
    );
    prismaMock.course.findFirst.mockResolvedValue(
      courseRecord({ instructorUserId: 'admin-1' }),
    );
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
    prismaMock.lesson.findMany.mockResolvedValue([
      lessonListItem({ id: 'lesson-1', title: 'Admin Lesson', order: 0 }),
    ]);

    const res = await request(app)
      .get(BASE)
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Admin Lesson');
  });

  it('rejects users whose membership belongs to another organization with 403', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-b/courses/course-1/modules/module-1/lessons')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
    expect(prismaMock.lesson.findMany).not.toHaveBeenCalled();
  });

  it('rejects when course does not exist in organization with 404', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get(BASE)
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
    expect(prismaMock.lesson.findMany).not.toHaveBeenCalled();
  });

  it('rejects when module does not exist with 404', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.module.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get(BASE)
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('MODULE_NOT_FOUND');
    expect(prismaMock.lesson.findMany).not.toHaveBeenCalled();
  });

  it('returns empty array when module has no lessons', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.lesson.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get(BASE)
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });
});

// ─── GET get lesson ────────────────────────────────────────────────────

describe('GET /api/v1/organizations/:orgId/courses/:courseId/modules/:moduleId/lessons/:lessonId', () => {
  const LESSON_URL = `${BASE}/lesson-1`;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get(LESSON_URL);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
    expect(prismaMock.lesson.findFirst).not.toHaveBeenCalled();
  });

  it('rejects instructors with unverified email with 403', async () => {
    await authenticateAs('INSTRUCTOR', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());

    const res = await request(app)
      .get(LESSON_URL)
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
  });

  it('rejects students with 403', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({ role: 'STUDENT' }));
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());

    const res = await request(app)
      .get(LESSON_URL)
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('returns a lesson for an authorized instructor', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.lesson.findFirst.mockResolvedValue(lessonRecord());

    const res = await request(app)
      .get(LESSON_URL)
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: 'lesson-1',
      moduleId: 'module-1',
      title: 'Lesson One',
      order: 0,
    });
    expect(prismaMock.lesson.findFirst).toHaveBeenCalledWith({
      where: { id: 'lesson-1', moduleId: 'module-1' },
    });
  });

  it('returns a lesson for an authorized organization admin', async () => {
    await authenticateAs('ORG_ADMIN', { userId: 'admin-1' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ userId: 'admin-1', role: 'ORG_ADMIN' }),
    );
    prismaMock.course.findFirst.mockResolvedValue(
      courseRecord({ instructorUserId: 'admin-1' }),
    );
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
    prismaMock.lesson.findFirst.mockResolvedValue(
      lessonRecord({ title: 'Admin Lesson' }),
    );

    const res = await request(app)
      .get(LESSON_URL)
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Admin Lesson');
  });

  it('rejects when lesson does not exist with 404', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.lesson.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get(LESSON_URL)
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('LESSON_NOT_FOUND');
  });

  it('rejects when module does not exist with 404', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.module.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get(LESSON_URL)
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('MODULE_NOT_FOUND');
  });

  it('rejects when course does not exist with 404', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get(LESSON_URL)
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
  });

  it('rejects users from another organization with 403', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-b/courses/course-1/modules/module-1/lessons/lesson-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
  });
});

// ─── PATCH update lesson ───────────────────────────────────────────────

describe('PATCH /api/v1/organizations/:orgId/courses/:courseId/modules/:moduleId/lessons/:lessonId', () => {
  const LESSON_URL = `${BASE}/lesson-1`;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .patch(LESSON_URL)
      .send({ title: 'Updated Lesson' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
    expect(prismaMock.lesson.update).not.toHaveBeenCalled();
  });

  it('updates a lesson for an authorized instructor', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.lesson.findFirst.mockResolvedValue(lessonRecord());
    prismaMock.lesson.update.mockImplementation(async ({ data }: { data?: Record<string, unknown> }) =>
      lessonRecord({ ...data, createdAt: now, updatedAt: now }),
    );

    const res = await request(app)
      .patch(LESSON_URL)
      .set('Cookie', cookie())
      .send({ title: 'Updated Lesson', order: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Updated Lesson');
    expect(res.body.data.order).toBe(1);
  });

  it('rejects update when lesson does not exist', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.lesson.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .patch(LESSON_URL)
      .set('Cookie', cookie())
      .send({ title: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('LESSON_NOT_FOUND');
  });

  it('rejects update with invalid order', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.lesson.findFirst.mockResolvedValue(lessonRecord());

    const res = await request(app)
      .patch(LESSON_URL)
      .set('Cookie', cookie())
      .send({ order: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_ORDER');
  });

  it('rejects update with invalid duration', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.lesson.findFirst.mockResolvedValue(lessonRecord());

    const res = await request(app)
      .patch(LESSON_URL)
      .set('Cookie', cookie())
      .send({ duration: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_DURATION');
  });

  it('rejects update with empty body (MISSING_FIELDS)', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.lesson.findFirst.mockResolvedValue(lessonRecord());

    const res = await request(app)
      .patch(LESSON_URL)
      .set('Cookie', cookie())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_FIELDS');
  });

  it('maps duplicate order to 409', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.lesson.findFirst.mockResolvedValue(lessonRecord());
    prismaMock.lesson.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '4.16.2',
      }),
    );

    const res = await request(app)
      .patch(LESSON_URL)
      .set('Cookie', cookie())
      .send({ order: 0 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('LESSON_ORDER_TAKEN');
  });

  it('rejects when course does not exist with 404', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .patch(LESSON_URL)
      .set('Cookie', cookie())
      .send({ title: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
  });

  it('rejects when module does not exist with 404', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.module.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .patch(LESSON_URL)
      .set('Cookie', cookie())
      .send({ title: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('MODULE_NOT_FOUND');
  });
});

// ─── DELETE delete lesson ──────────────────────────────────────────────

describe('DELETE /api/v1/organizations/:orgId/courses/:courseId/modules/:moduleId/lessons/:lessonId', () => {
  const LESSON_URL = `${BASE}/lesson-1`;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).delete(LESSON_URL);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
    expect(prismaMock.lesson.delete).not.toHaveBeenCalled();
  });

  it('deletes a lesson for an authorized instructor', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.lesson.findFirst.mockResolvedValue(lessonRecord());
    prismaMock.lesson.delete.mockResolvedValue({});

    const res = await request(app)
      .delete(LESSON_URL)
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prismaMock.lesson.delete).toHaveBeenCalledWith({
      where: { id: 'lesson-1' },
    });
  });

  it('deletes a lesson for an authorized organization admin', async () => {
    await authenticateAs('ORG_ADMIN', { userId: 'admin-1' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ userId: 'admin-1', role: 'ORG_ADMIN' }),
    );
    prismaMock.course.findFirst.mockResolvedValue(
      courseRecord({ instructorUserId: 'admin-1' }),
    );
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
    prismaMock.lesson.findFirst.mockResolvedValue(lessonRecord());
    prismaMock.lesson.delete.mockResolvedValue({});

    const res = await request(app)
      .delete(LESSON_URL)
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects delete when lesson does not exist', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.lesson.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .delete(LESSON_URL)
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('LESSON_NOT_FOUND');
  });

  it('rejects delete when module does not exist with 404', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.module.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .delete(LESSON_URL)
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('MODULE_NOT_FOUND');
  });

  it('rejects delete when course does not belong to organization', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .delete(LESSON_URL)
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
  });

  it('rejects delete when user belongs to another organization', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/v1/organizations/org-b/courses/course-1/modules/module-1/lessons/lesson-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
  });
});

// ─── Cross-tenant isolation ────────────────────────────────────────────

describe('Cross-tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('cannot access lessons via a module from another course', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses/course-from-another-tenant/modules/module-1/lessons')
      .set('Cookie', cookie())
      .send({ title: 'Sneaky Lesson', order: 0 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
    expect(prismaMock.lesson.create).not.toHaveBeenCalled();
  });

  it('cannot list lessons for a module in another tenant', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses/course-from-another-tenant/modules/module-1/lessons')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
    expect(prismaMock.lesson.findMany).not.toHaveBeenCalled();
  });
});
