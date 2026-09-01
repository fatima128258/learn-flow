import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  userOrganization: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  course: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  category: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock('../services/authService', () => ({
  getSessionFromToken: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock('../services/notificationDispatcher', () => ({
  dispatchNotification: vi.fn(async () => true),
}));

vi.mock('../services/auditLogService', () => ({
  record: vi.fn(async () => true),
}));

vi.mock('../prisma', () => ({
  default: () => prismaMock,
}));

import app from '../server';
import * as authService from '../services/authService';
import * as dispatcher from '../services/notificationDispatcher';

const now = new Date('2026-08-28T16:00:00.000Z');

function courseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    organizationId: 'org-a',
    instructorUserId: 'user-1',
    title: 'React Fundamentals',
    slug: 'react-fundamentals',
    description: null,
    thumbnailUrl: null,
    category: null,
    price: null,
    discountPrice: null,
    status: 'DRAFT',
    publishedAt: null,
    estimatedMinutes: 120,
    difficulty: 'BEGINNER',
    learningObjectives: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function authenticateAs(
  role: 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'INSTRUCTOR' | 'STUDENT',
  options?: { userId?: string; organizationId?: string },
) {
  const userId = options?.userId ?? 'user-1';
  const organizationId = options?.organizationId ?? 'org-a';

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
    emailVerified: true,
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

  prismaMock.userOrganization.findUnique.mockImplementation(async ({ where }: { where?: { role?: string; organizationId?: string; userId?: string; id?: string; courseId?: string; moduleId?: string; quizId?: string; status?: string; userId_organizationId?: { userId?: string; organizationId?: string } } }) => {
    if (where?.userId_organizationId?.organizationId === organizationId) {
      return { role, organizationId, userId };
    }
    return null;
  });
}

function cookie() {
  return ['learnflow_session=valid-token'];
}

describe('PATCH /api/v1/organizations/:organizationId/courses/:courseId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dispatcher.dispatchNotification).mockResolvedValue(true);
  });

  it('lets an instructor update their own course', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.course.findFirst
      .mockResolvedValueOnce(courseRecord())
      .mockResolvedValueOnce(courseRecord({ title: 'Updated Title' }));
    prismaMock.course.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.category.findFirst.mockResolvedValue(null);
    prismaMock.category.create.mockResolvedValue({ id: 'cat-1' });

    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-1')
      .set('Cookie', cookie())
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Updated Title');
  });

  it('rejects an instructor trying to update another instructor course with 403', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.course.findFirst.mockResolvedValue(
      courseRecord({ instructorUserId: 'user-999' }),
    );

    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-1')
      .set('Cookie', cookie())
      .send({ title: 'Sneaky' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(prismaMock.course.updateMany).not.toHaveBeenCalled();
  });

  it('lets an ORG_ADMIN update any course in the organization', async () => {
    await authenticateAs('ORG_ADMIN');
    prismaMock.course.findFirst
      .mockResolvedValueOnce(courseRecord({ instructorUserId: 'user-999' }))
      .mockResolvedValueOnce(courseRecord({ title: 'Admin Updated', instructorUserId: 'user-999' }));
    prismaMock.course.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-1')
      .set('Cookie', cookie())
      .send({ estimatedMinutes: 90 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 INVALID_SLUG for an invalid slug', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());

    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-1')
      .set('Cookie', cookie())
      .send({ slug: 'UPPER CASE Bad!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_SLUG');
  });
});

describe('PATCH /api/v1/organizations/:organizationId/courses/:courseId/status (ownership)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dispatcher.dispatchNotification).mockResolvedValue(true);
  });

  it('lets an instructor publish their own course', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.course.findFirst
      .mockResolvedValueOnce(courseRecord({ status: 'DRAFT' }))
      .mockResolvedValueOnce(courseRecord({ status: 'PUBLISHED', publishedAt: now }));
    prismaMock.course.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-1/status')
      .set('Cookie', cookie())
      .send({ status: 'PUBLISHED' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects an instructor publishing another instructor course with 403', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.course.findFirst.mockResolvedValue(
      courseRecord({ status: 'DRAFT', instructorUserId: 'user-999' }),
    );

    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-1/status')
      .set('Cookie', cookie())
      .send({ status: 'PUBLISHED' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(prismaMock.course.updateMany).not.toHaveBeenCalled();
  });

  it('lets an ORG_ADMIN publish any course in the organization', async () => {
    await authenticateAs('ORG_ADMIN');
    prismaMock.course.findFirst
      .mockResolvedValueOnce(courseRecord({ status: 'DRAFT', instructorUserId: 'user-999' }))
      .mockResolvedValueOnce(courseRecord({ status: 'PUBLISHED', publishedAt: now, instructorUserId: 'user-999' }));
    prismaMock.course.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-1/status')
      .set('Cookie', cookie())
      .send({ status: 'PUBLISHED' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
