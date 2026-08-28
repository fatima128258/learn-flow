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
};

vi.mock('../services/authService', () => ({
  getSessionFromToken: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock('../services/notificationDispatcher', () => ({
  dispatchNotification: vi.fn(async () => true),
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
    category: 'Frontend',
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

  prismaMock.userOrganization.findFirst.mockImplementation(async ({ where }: any) => {
    if (where?.role === 'PLATFORM_ADMIN') {
      return role === 'PLATFORM_ADMIN' ? { role, organizationId, userId } : null;
    }
    return null;
  });

  prismaMock.userOrganization.findUnique.mockImplementation(async ({ where }: any) => {
    if (where.userId_organizationId?.organizationId === organizationId) {
      return { role, organizationId, userId };
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
  prismaMock.course.findFirst.mockReset();
  prismaMock.course.updateMany.mockReset();
  vi.mocked(dispatcher.dispatchNotification).mockReset();
}

describe('PATCH /api/v1/organizations/:organizationId/courses/:courseId/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
    vi.mocked(dispatcher.dispatchNotification).mockResolvedValue(true);
  });

  it('publishes a course for an instructor in the tenant and notifies the instructor', async () => {
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
    expect(res.body.data.status).toBe('PUBLISHED');
    expect(prismaMock.course.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'course-1', organizationId: 'org-a' },
        data: expect.objectContaining({ status: 'PUBLISHED' }),
      }),
    );
    expect(dispatcher.dispatchNotification).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'COURSE_PUBLISHED',
        userId: 'user-1',
        organizationId: 'org-a',
      }),
    );
  });

  it('allows an org admin to publish a course', async () => {
    await authenticateAs('ORG_ADMIN');
    prismaMock.course.findFirst
      .mockResolvedValueOnce(courseRecord({ status: 'DRAFT' }))
      .mockResolvedValueOnce(courseRecord({ status: 'PUBLISHED', publishedAt: now }));
    prismaMock.course.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-1/status')
      .set('Cookie', cookie())
      .send({ status: 'PUBLISHED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PUBLISHED');
  });

  it('rejects a student with 403', async () => {
    await authenticateAs('STUDENT');

    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-1/status')
      .set('Cookie', cookie())
      .send({ status: 'PUBLISHED' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
    expect(dispatcher.dispatchNotification).not.toHaveBeenCalled();
  });

  it('rejects an invalid status with 400', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.course.findFirst.mockResolvedValue(courseRecord({ status: 'DRAFT' }));

    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-1/status')
      .set('Cookie', cookie())
      .send({ status: 'HIDDEN' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_STATUS');
    expect(dispatcher.dispatchNotification).not.toHaveBeenCalled();
  });

  it('cannot publish a course from another tenant (404)', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-1/status')
      .set('Cookie', cookie())
      .send({ status: 'PUBLISHED' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
    expect(dispatcher.dispatchNotification).not.toHaveBeenCalled();
  });
});