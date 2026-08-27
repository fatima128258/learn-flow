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
  prismaMock.module.create.mockReset();
  prismaMock.module.findMany.mockReset();
  prismaMock.module.findFirst.mockReset();
  prismaMock.module.update.mockReset();
  prismaMock.module.delete.mockReset();
}

describe('POST /api/v1/organizations/:organizationId/courses/:courseId/modules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses/course-1/modules')
      .send({ title: 'Module One', order: 0 });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
    expect(prismaMock.module.create).not.toHaveBeenCalled();
  });

  it('rejects instructors with unverified email with 403', async () => {
    await authenticateAs('INSTRUCTOR', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses/course-1/modules')
      .set('Cookie', cookie())
      .send({ title: 'Module One', order: 0 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
    expect(prismaMock.module.create).not.toHaveBeenCalled();
  });

  it('rejects students with 403', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({ role: 'STUDENT' }));
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses/course-1/modules')
      .set('Cookie', cookie())
      .send({ title: 'Module One', order: 0 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
    expect(prismaMock.module.create).not.toHaveBeenCalled();
  });

  it('rejects when course does not exist in organization with 404', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses/non-existent/modules')
      .set('Cookie', cookie())
      .send({ title: 'Module One', order: 0 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
    expect(prismaMock.module.create).not.toHaveBeenCalled();
  });

  it('creates a module for an instructor in their own organization', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.create.mockImplementation(async ({ data }: any) =>
      moduleRecord({
        id: 'module-1',
        ...data,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses/course-1/modules')
      .set('Cookie', cookie())
      .send({ title: 'Module One', order: 0 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: 'module-1',
      courseId: 'course-1',
      title: 'Module One',
      order: 0,
    });
    expect(prismaMock.module.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        courseId: 'course-1',
        title: 'Module One',
        order: 0,
      }),
    }));
  });

  it('creates a module for an organization admin in their own organization', async () => {
    await authenticateAs('ORG_ADMIN', { userId: 'admin-1' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({
      userId: 'admin-1',
      role: 'ORG_ADMIN',
    }));
    prismaMock.course.findFirst.mockResolvedValue(courseRecord({ instructorUserId: 'admin-1' }));
    prismaMock.module.create.mockImplementation(async ({ data }: any) =>
      moduleRecord({
        id: 'module-2',
        ...data,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses/course-1/modules')
      .set('Cookie', cookie())
      .send({ title: 'Admin Module', order: 0, description: 'Desc' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Admin Module');
  });

  it('rejects users whose membership belongs to another organization with 403', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/organizations/org-b/courses/course-1/modules')
      .set('Cookie', cookie())
      .send({ title: 'Foreign Module', order: 0 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
    expect(prismaMock.module.create).not.toHaveBeenCalled();
  });

  it('rejects when course belongs to another organization (cross-tenant)', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses/course-from-org-b/modules')
      .set('Cookie', cookie())
      .send({ title: 'Cross-tenant Module', order: 0 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
    expect(prismaMock.module.create).not.toHaveBeenCalled();
  });

  it('returns 400 when title is missing or blank', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());

    const missing = await request(app)
      .post('/api/v1/organizations/org-a/courses/course-1/modules')
      .set('Cookie', cookie())
      .send({ order: 0 });

    const blank = await request(app)
      .post('/api/v1/organizations/org-a/courses/course-1/modules')
      .set('Cookie', cookie())
      .send({ title: '   ', order: 0 });

    expect(missing.status).toBe(400);
    expect(missing.body.success).toBe(false);
    expect(missing.body.error).toBe('MISSING_FIELDS');
    expect(blank.status).toBe(400);
    expect(blank.body.error).toBe('MISSING_FIELDS');
    expect(prismaMock.module.create).not.toHaveBeenCalled();
  });

  it('returns 400 when order is missing', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses/course-1/modules')
      .set('Cookie', cookie())
      .send({ title: 'Module Without Order' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_FIELDS');
    expect(prismaMock.module.create).not.toHaveBeenCalled();
  });

  it('returns 400 when order is not a valid non-negative integer', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());

    const negative = await request(app)
      .post('/api/v1/organizations/org-a/courses/course-1/modules')
      .set('Cookie', cookie())
      .send({ title: 'Module', order: -1 });

    const nonInteger = await request(app)
      .post('/api/v1/organizations/org-a/courses/course-1/modules')
      .set('Cookie', cookie())
      .send({ title: 'Module', order: 1.5 });

    expect(negative.status).toBe(400);
    expect(negative.body.error).toBe('INVALID_ORDER');
    expect(nonInteger.status).toBe(400);
    expect(nonInteger.body.error).toBe('INVALID_ORDER');
    expect(prismaMock.module.create).not.toHaveBeenCalled();
  });

  it('maps duplicate order within the same course to 409', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '4.16.2',
      }),
    );

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses/course-1/modules')
      .set('Cookie', cookie())
      .send({ title: 'Duplicate Order', order: 0 });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('MODULE_ORDER_TAKEN');
  });
});

describe('GET /api/v1/organizations/:organizationId/courses/:courseId/modules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/organizations/org-a/courses/course-1/modules');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
    expect(prismaMock.module.findMany).not.toHaveBeenCalled();
  });

  it('rejects instructors with unverified email with 403', async () => {
    await authenticateAs('INSTRUCTOR', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses/course-1/modules')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
    expect(prismaMock.module.findMany).not.toHaveBeenCalled();
  });

  it('rejects students with 403', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({ role: 'STUDENT' }));
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses/course-1/modules')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
    expect(prismaMock.module.findMany).not.toHaveBeenCalled();
  });

  it('returns modules for an authorized instructor in their own organization', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findMany.mockResolvedValue([
      moduleRecord({ id: 'module-1', title: 'Module One', order: 0 }),
      moduleRecord({ id: 'module-2', title: 'Module Two', order: 1 }),
    ]);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses/course-1/modules')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      id: 'module-1',
      title: 'Module One',
      order: 0,
    });
    expect(res.body.data[1]).toMatchObject({
      id: 'module-2',
      title: 'Module Two',
      order: 1,
    });
    expect(prismaMock.module.findMany).toHaveBeenCalledWith({
      where: { courseId: 'course-1' },
      select: expect.objectContaining({
        id: true,
        title: true,
        description: true,
        order: true,
        createdAt: true,
        updatedAt: true,
      }),
      orderBy: { order: 'asc' },
    });
  });

  it('returns modules for an authorized organization admin in their own organization', async () => {
    await authenticateAs('ORG_ADMIN', { userId: 'admin-1' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({
      userId: 'admin-1',
      role: 'ORG_ADMIN',
    }));
    prismaMock.course.findFirst.mockResolvedValue(courseRecord({ instructorUserId: 'admin-1' }));
    prismaMock.module.findMany.mockResolvedValue([
      moduleRecord({ id: 'module-1', title: 'Admin Module', order: 0 }),
    ]);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses/course-1/modules')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Admin Module');
  });

  it('rejects users whose membership belongs to another organization with 403', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-b/courses/course-1/modules')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
    expect(prismaMock.module.findMany).not.toHaveBeenCalled();
  });

  it('rejects when course does not belong to the organization', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses/course-from-org-b/modules')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
    expect(prismaMock.module.findMany).not.toHaveBeenCalled();
  });

  it('returns empty array when course has no modules', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses/course-1/modules')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });
});

describe('PATCH /api/v1/organizations/:organizationId/courses/:courseId/modules/:moduleId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-1/modules/module-1')
      .send({ title: 'Updated Module' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
    expect(prismaMock.module.update).not.toHaveBeenCalled();
  });

  it('updates a module for an authorized instructor', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
    prismaMock.module.update.mockImplementation(async ({ data }: any) =>
      moduleRecord({ ...data, createdAt: now, updatedAt: now }),
    );

    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-1/modules/module-1')
      .set('Cookie', cookie())
      .send({ title: 'Updated Module', order: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Updated Module');
    expect(res.body.data.order).toBe(1);
  });

  it('rejects update when module does not exist', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-1/modules/non-existent')
      .set('Cookie', cookie())
      .send({ title: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('MODULE_NOT_FOUND');
  });

  it('rejects update with invalid order', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());

    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-1/modules/module-1')
      .set('Cookie', cookie())
      .send({ order: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_ORDER');
  });

  it('maps duplicate order to 409', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
    prismaMock.module.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '4.16.2',
      }),
    );

    const res = await request(app)
      .patch('/api/v1/organizations/org-a/courses/course-1/modules/module-1')
      .set('Cookie', cookie())
      .send({ order: 0 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('MODULE_ORDER_TAKEN');
  });
});

describe('DELETE /api/v1/organizations/:organizationId/courses/:courseId/modules/:moduleId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .delete('/api/v1/organizations/org-a/courses/course-1/modules/module-1');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
    expect(prismaMock.module.delete).not.toHaveBeenCalled();
  });

  it('deletes a module for an authorized instructor', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
    prismaMock.module.delete.mockResolvedValue({});

    const res = await request(app)
      .delete('/api/v1/organizations/org-a/courses/course-1/modules/module-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prismaMock.module.delete).toHaveBeenCalledWith({
      where: { id: 'module-1' },
    });
  });

  it('rejects delete when module does not exist', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.module.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/v1/organizations/org-a/courses/course-1/modules/non-existent')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('MODULE_NOT_FOUND');
  });

  it('rejects delete when course does not belong to organization', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/v1/organizations/org-a/courses/course-from-org-b/modules/module-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
  });
});