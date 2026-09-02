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
  quiz: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
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
    title: 'Test Course',
    slug: 'test-course',
    status: 'DRAFT',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function moduleRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'module-1',
    courseId: 'course-1',
    title: 'Test Module',
    order: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function quizRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'quiz-1',
    moduleId: 'module-1',
    title: 'Test Quiz',
    description: 'A test quiz',
    timeLimitMinutes: 30,
    passingPercentage: 70,
    maxAttempts: 3,
    order: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function quizListItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'quiz-1',
    title: 'Test Quiz',
    description: 'A test quiz',
    timeLimitMinutes: 30,
    passingPercentage: 70,
    maxAttempts: 3,
    order: 0,
    createdAt: now,
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

  prismaMock.userOrganization.findUnique.mockResolvedValue(
    membershipRecord({ role, organizationId, userId }),
  );
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
  prismaMock.quiz.create.mockReset();
  prismaMock.quiz.findMany.mockReset();
  prismaMock.quiz.findFirst.mockReset();
  prismaMock.quiz.update.mockReset();
  prismaMock.quiz.updateMany.mockReset();
  prismaMock.quiz.delete.mockReset();
  prismaMock.quiz.deleteMany.mockReset();
  vi.mocked(authService.getSessionFromToken).mockReset();
  vi.mocked(authService.getUserById).mockReset();
}

const BASE = '/api/v1/organizations/org-a/courses/course-1/modules/module-1/quizzes';

async function setValidAuth(role: 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'INSTRUCTOR' | 'STUDENT' = 'INSTRUCTOR') {
  await authenticateAs(role);
  prismaMock.userOrganization.findUnique.mockResolvedValue(
    membershipRecord({ role }),
  );
  prismaMock.course.findFirst.mockResolvedValue(courseRecord());
  prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
}

beforeEach(() => {
  resetMocks();
});

describe('POST /api/v1/organizations/:organizationId/courses/:courseId/modules/:moduleId/quizzes', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).post(BASE).send({});
    expect(res.status).toBe(401);
  });

  it('returns 403 when email is not verified', async () => {
    await authenticateAs('INSTRUCTOR', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Quiz 1', order: 0 });
    expect(res.status).toBe(403);
  });

  it('returns 403 for student role', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({ role: 'STUDENT' }));
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Quiz 1', order: 0 });
    expect(res.status).toBe(403);
  });

  it('creates quiz as instructor', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.quiz.create.mockResolvedValue(quizRecord());

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Quiz 1', order: 0, description: 'desc', timeLimitMinutes: 30, passingPercentage: 70, maxAttempts: 3 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('quiz-1');
  });

  it('creates quiz as org admin', async () => {
    await setValidAuth('ORG_ADMIN');
    prismaMock.quiz.create.mockResolvedValue(quizRecord());

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Quiz 1', order: 0 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 for cross-organization membership', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-b' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Quiz 1', order: 0 });
    expect(res.status).toBe(403);
  });

  it('returns 404 when course not found', async () => {
    await setValidAuth();
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Quiz 1', order: 0 });
    expect(res.status).toBe(404);
  });

  it('returns 404 when module not found', async () => {
    await setValidAuth();
    prismaMock.module.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Quiz 1', order: 0 });
    expect(res.status).toBe(404);
  });

  it('returns 400 when title is missing', async () => {
    await setValidAuth();

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ order: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_FIELDS');
  });

  it('returns 400 when order is missing', async () => {
    await setValidAuth();

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Quiz 1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_FIELDS');
  });

  it('returns 400 when order is negative', async () => {
    await setValidAuth();

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Quiz 1', order: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_ORDER');
  });

  it('returns 400 when order is not an integer', async () => {
    await setValidAuth();

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Quiz 1', order: 1.5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_ORDER');
  });

  it('returns 400 when passingPercentage is negative', async () => {
    await setValidAuth();

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Quiz 1', order: 0, passingPercentage: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_VALUE');
  });

  it('returns 400 when passingPercentage exceeds 100', async () => {
    await setValidAuth();

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Quiz 1', order: 0, passingPercentage: 101 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_VALUE');
  });

  it('returns 400 when maxAttempts is less than 1', async () => {
    await setValidAuth();

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Quiz 1', order: 0, maxAttempts: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_VALUE');
  });

  it('returns 400 when timeLimitMinutes is less than 1', async () => {
    await setValidAuth();

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Quiz 1', order: 0, timeLimitMinutes: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_VALUE');
  });

  it('returns 409 when order is duplicate', async () => {
    await setValidAuth();
    prismaMock.quiz.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '4.0.0', meta: {} }),
    );

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Quiz 1', order: 0 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('QUIZ_ORDER_TAKEN');
  });
});

describe('GET /api/v1/organizations/:organizationId/courses/:courseId/modules/:moduleId/quizzes', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(401);
  });

  it('returns 403 when email is not verified', async () => {
    await authenticateAs('INSTRUCTOR', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());

    const res = await request(app).get(BASE).set('Cookie', cookie());
    expect(res.status).toBe(403);
  });

  it('returns 403 for student role', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({ role: 'STUDENT' }));
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());

    const res = await request(app).get(BASE).set('Cookie', cookie());
    expect(res.status).toBe(403);
  });

  it('lists quizzes as instructor', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.quiz.findMany.mockResolvedValue([quizListItem()]);

    const res = await request(app).get(BASE).set('Cookie', cookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('lists quizzes as org admin', async () => {
    await setValidAuth('ORG_ADMIN');
    prismaMock.quiz.findMany.mockResolvedValue([quizListItem()]);

    const res = await request(app).get(BASE).set('Cookie', cookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 for cross-organization membership', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-b' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app).get(BASE).set('Cookie', cookie());
    expect(res.status).toBe(403);
  });

  it('returns 404 when course not found', async () => {
    await setValidAuth();
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app).get(BASE).set('Cookie', cookie());
    expect(res.status).toBe(404);
  });

  it('returns 404 when module not found', async () => {
    await setValidAuth();
    prismaMock.module.findFirst.mockResolvedValue(null);

    const res = await request(app).get(BASE).set('Cookie', cookie());
    expect(res.status).toBe(404);
  });

  it('returns empty array when no quizzes exist', async () => {
    await setValidAuth();
    prismaMock.quiz.findMany.mockResolvedValue([]);

    const res = await request(app).get(BASE).set('Cookie', cookie());
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /api/v1/organizations/:organizationId/courses/:courseId/modules/:moduleId/quizzes/:quizId', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get(`${BASE}/quiz-1`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when email is not verified', async () => {
    await authenticateAs('INSTRUCTOR', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());

    const res = await request(app).get(`${BASE}/quiz-1`).set('Cookie', cookie());
    expect(res.status).toBe(403);
  });

  it('returns 403 for student role', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({ role: 'STUDENT' }));
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());

    const res = await request(app).get(`${BASE}/quiz-1`).set('Cookie', cookie());
    expect(res.status).toBe(403);
  });

  it('gets quiz as instructor', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.quiz.findFirst.mockResolvedValue(quizRecord());

    const res = await request(app).get(`${BASE}/quiz-1`).set('Cookie', cookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('quiz-1');
  });

  it('gets quiz as org admin', async () => {
    await setValidAuth('ORG_ADMIN');
    prismaMock.quiz.findFirst.mockResolvedValue(quizRecord());

    const res = await request(app).get(`${BASE}/quiz-1`).set('Cookie', cookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 for cross-organization membership', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-b' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app).get(`${BASE}/quiz-1`).set('Cookie', cookie());
    expect(res.status).toBe(403);
  });

  it('returns 404 when course not found', async () => {
    await setValidAuth();
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app).get(`${BASE}/quiz-1`).set('Cookie', cookie());
    expect(res.status).toBe(404);
  });

  it('returns 404 when module not found', async () => {
    await setValidAuth();
    prismaMock.module.findFirst.mockResolvedValue(null);

    const res = await request(app).get(`${BASE}/quiz-1`).set('Cookie', cookie());
    expect(res.status).toBe(404);
  });

  it('returns 404 when quiz not found', async () => {
    await setValidAuth();
    prismaMock.quiz.findFirst.mockResolvedValue(null);

    const res = await request(app).get(`${BASE}/quiz-1`).set('Cookie', cookie());
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('QUIZ_NOT_FOUND');
  });
});

describe('PATCH /api/v1/organizations/:organizationId/courses/:courseId/modules/:moduleId/quizzes/:quizId', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).patch(`${BASE}/quiz-1`).send({ title: 'Updated' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when email is not verified', async () => {
    await authenticateAs('INSTRUCTOR', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());

    const res = await request(app)
      .patch(`${BASE}/quiz-1`)
      .set('Cookie', cookie())
      .send({ title: 'Updated' });
    expect(res.status).toBe(403);
  });

  it('returns 403 for student role', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({ role: 'STUDENT' }));
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());

    const res = await request(app)
      .patch(`${BASE}/quiz-1`)
      .set('Cookie', cookie())
      .send({ title: 'Updated' });
    expect(res.status).toBe(403);
  });

  it('updates quiz as instructor', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.quiz.findFirst.mockResolvedValue(quizRecord());
    // updateQuiz now uses updateMany bound to (quizId, moduleId), then findFirst (C-03 fix).
    prismaMock.quiz.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.quiz.findFirst
      .mockResolvedValueOnce(quizRecord())                          // pre-check getById
      .mockResolvedValueOnce(quizRecord({ title: 'Updated Quiz' })); // post-update fetch

    const res = await request(app)
      .patch(`${BASE}/quiz-1`)
      .set('Cookie', cookie())
      .send({ title: 'Updated Quiz' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prismaMock.quiz.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'quiz-1', moduleId: 'module-1' }),
    }));
  });

  it('updates quiz as org admin', async () => {
    await setValidAuth('ORG_ADMIN');
    prismaMock.quiz.findFirst.mockResolvedValue(quizRecord());
    prismaMock.quiz.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.quiz.findFirst
      .mockResolvedValueOnce(quizRecord())
      .mockResolvedValueOnce(quizRecord({ title: 'Updated Quiz' }));

    const res = await request(app)
      .patch(`${BASE}/quiz-1`)
      .set('Cookie', cookie())
      .send({ title: 'Updated Quiz' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 for cross-organization membership', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-b' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .patch(`${BASE}/quiz-1`)
      .set('Cookie', cookie())
      .send({ title: 'Updated' });
    expect(res.status).toBe(403);
  });

  it('returns 404 when course not found', async () => {
    await setValidAuth();
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .patch(`${BASE}/quiz-1`)
      .set('Cookie', cookie())
      .send({ title: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when module not found', async () => {
    await setValidAuth();
    prismaMock.module.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .patch(`${BASE}/quiz-1`)
      .set('Cookie', cookie())
      .send({ title: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when quiz not found', async () => {
    await setValidAuth();
    prismaMock.quiz.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .patch(`${BASE}/quiz-1`)
      .set('Cookie', cookie())
      .send({ title: 'Updated' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('QUIZ_NOT_FOUND');
  });

  it('returns 400 when title is empty', async () => {
    await setValidAuth();
    prismaMock.quiz.findFirst.mockResolvedValue(quizRecord());

    const res = await request(app)
      .patch(`${BASE}/quiz-1`)
      .set('Cookie', cookie())
      .send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_FIELDS');
  });

  it('returns 400 when order is negative', async () => {
    await setValidAuth();
    prismaMock.quiz.findFirst.mockResolvedValue(quizRecord());

    const res = await request(app)
      .patch(`${BASE}/quiz-1`)
      .set('Cookie', cookie())
      .send({ order: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_ORDER');
  });

  it('returns 400 when order is not an integer', async () => {
    await setValidAuth();
    prismaMock.quiz.findFirst.mockResolvedValue(quizRecord());

    const res = await request(app)
      .patch(`${BASE}/quiz-1`)
      .set('Cookie', cookie())
      .send({ order: 1.5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_ORDER');
  });

  it('returns 400 when body is empty', async () => {
    await setValidAuth();
    prismaMock.quiz.findFirst.mockResolvedValue(quizRecord());

    const res = await request(app)
      .patch(`${BASE}/quiz-1`)
      .set('Cookie', cookie())
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_FIELDS');
  });

  it('returns 400 when passingPercentage is negative', async () => {
    await setValidAuth();
    prismaMock.quiz.findFirst.mockResolvedValue(quizRecord());

    const res = await request(app)
      .patch(`${BASE}/quiz-1`)
      .set('Cookie', cookie())
      .send({ passingPercentage: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_VALUE');
  });

  it('returns 400 when passingPercentage exceeds 100', async () => {
    await setValidAuth();
    prismaMock.quiz.findFirst.mockResolvedValue(quizRecord());

    const res = await request(app)
      .patch(`${BASE}/quiz-1`)
      .set('Cookie', cookie())
      .send({ passingPercentage: 101 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_VALUE');
  });

  it('returns 400 when maxAttempts is less than 1', async () => {
    await setValidAuth();
    prismaMock.quiz.findFirst.mockResolvedValue(quizRecord());

    const res = await request(app)
      .patch(`${BASE}/quiz-1`)
      .set('Cookie', cookie())
      .send({ maxAttempts: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_VALUE');
  });

  it('returns 409 when order is duplicate', async () => {
    await setValidAuth();
    prismaMock.quiz.findFirst.mockResolvedValue(quizRecord());
    prismaMock.quiz.updateMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '4.0.0', meta: {} }),
    );

    const res = await request(app)
      .patch(`${BASE}/quiz-1`)
      .set('Cookie', cookie())
      .send({ order: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('QUIZ_ORDER_TAKEN');
  });
});

describe('DELETE /api/v1/organizations/:organizationId/courses/:courseId/modules/:moduleId/quizzes/:quizId', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).delete(`${BASE}/quiz-1`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when email is not verified', async () => {
    await authenticateAs('INSTRUCTOR', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());

    const res = await request(app).delete(`${BASE}/quiz-1`).set('Cookie', cookie());
    expect(res.status).toBe(403);
  });

  it('returns 403 for student role', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({ role: 'STUDENT' }));
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());

    const res = await request(app).delete(`${BASE}/quiz-1`).set('Cookie', cookie());
    expect(res.status).toBe(403);
  });

  it('deletes quiz as instructor', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.quiz.findFirst.mockResolvedValue(quizRecord());
    // deleteQuiz now uses deleteMany bound to (quizId, moduleId) (C-03 fix).
    prismaMock.quiz.deleteMany.mockResolvedValue({ count: 1 });

    const res = await request(app).delete(`${BASE}/quiz-1`).set('Cookie', cookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prismaMock.quiz.deleteMany).toHaveBeenCalledWith({
      where: { id: 'quiz-1', moduleId: 'module-1' },
    });
  });

  it('deletes quiz as org admin', async () => {
    await setValidAuth('ORG_ADMIN');
    prismaMock.quiz.findFirst.mockResolvedValue(quizRecord());
    prismaMock.quiz.deleteMany.mockResolvedValue({ count: 1 });

    const res = await request(app).delete(`${BASE}/quiz-1`).set('Cookie', cookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 for cross-organization membership', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-b' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app).delete(`${BASE}/quiz-1`).set('Cookie', cookie());
    expect(res.status).toBe(403);
  });

  it('returns 404 when course not found', async () => {
    await setValidAuth();
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app).delete(`${BASE}/quiz-1`).set('Cookie', cookie());
    expect(res.status).toBe(404);
  });

  it('returns 404 when module not found', async () => {
    await setValidAuth();
    prismaMock.module.findFirst.mockResolvedValue(null);

    const res = await request(app).delete(`${BASE}/quiz-1`).set('Cookie', cookie());
    expect(res.status).toBe(404);
  });

  it('returns 404 when quiz not found', async () => {
    await setValidAuth();
    prismaMock.quiz.findFirst.mockResolvedValue(null);

    const res = await request(app).delete(`${BASE}/quiz-1`).set('Cookie', cookie());
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('QUIZ_NOT_FOUND');
  });
});

describe('Cross-tenant isolation', () => {
  it('prevents cross-tenant course access on list', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-b' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get(BASE)
      .set('Cookie', cookie());
    expect(res.status).toBe(403);
  });

  it('prevents cross-tenant course access on create', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-b' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({ title: 'Quiz 1', order: 0 });
    expect(res.status).toBe(403);
  });
});
