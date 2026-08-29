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
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
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
  prismaMock.course.create.mockReset();
  prismaMock.course.findMany.mockReset();
  prismaMock.course.count.mockReset();
  prismaMock.category.findFirst.mockReset();
  prismaMock.category.create.mockReset();
}

describe('POST /api/v1/organizations/:organizationId/courses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses')
      .send({ title: 'Intro to Testing' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
    expect(prismaMock.course.create).not.toHaveBeenCalled();
  });

  it('rejects instructors with unverified email and does not reach the service', async () => {
    await authenticateAs('INSTRUCTOR', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie())
      .send({ title: 'Intro to Testing' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
    expect(prismaMock.course.create).not.toHaveBeenCalled();
  });

  it('rejects students with 403', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({ role: 'STUDENT' }));

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie())
      .send({ title: 'Intro to Testing' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
    expect(prismaMock.course.create).not.toHaveBeenCalled();
  });

  it('creates a draft course for an instructor in their own organization', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.create.mockImplementation(async ({ data }: any) =>
      courseRecord({
        id: 'course-1',
        ...data,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie())
      .send({ title: 'Intro to Testing' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: 'course-1',
      organizationId: 'org-a',
      instructorUserId: 'user-1',
      title: 'Intro to Testing',
      slug: 'intro-to-testing',
      status: 'DRAFT',
      publishedAt: null,
    });
    expect(prismaMock.course.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: 'org-a',
        instructorUserId: 'user-1',
        slug: 'intro-to-testing',
        status: 'DRAFT',
        publishedAt: null,
      }),
    }));
  });

  it('creates a draft course for an organization admin attributed to themselves', async () => {
    await authenticateAs('ORG_ADMIN', { userId: 'admin-1' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({
      userId: 'admin-1',
      role: 'ORG_ADMIN',
    }));
    prismaMock.course.create.mockImplementation(async ({ data }: any) =>
      courseRecord({
        id: 'course-2',
        instructorUserId: 'admin-1',
        ...data,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie())
      .send({ title: 'Org Admin Course', description: 'Desc' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.instructorUserId).toBe('admin-1');
    expect(prismaMock.course.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: 'org-a',
        instructorUserId: 'admin-1',
        status: 'DRAFT',
      }),
    }));
  });

  it('rejects users whose membership belongs to another organization with 403', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/organizations/org-b/courses')
      .set('Cookie', cookie())
      .send({ title: 'Foreign Course' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
    expect(prismaMock.course.create).not.toHaveBeenCalled();
  });

  it('ignores client-supplied tenant, instructor, status, and publishedAt fields', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.create.mockImplementation(async ({ data }: any) =>
      courseRecord({ ...data, createdAt: now, updatedAt: now }),
    );

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie())
      .send({
        title: 'Hijack Attempt',
        organizationId: 'org-b',
        instructorId: 'attacker-1',
        instructorUserId: 'attacker-1',
        status: 'PUBLISHED',
        publishedAt: '2026-01-01T00:00:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.organizationId).toBe('org-a');
    expect(res.body.data.instructorUserId).toBe('user-1');
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.publishedAt).toBeNull();
    expect(prismaMock.course.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.course.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: 'org-a',
        instructorUserId: 'user-1',
        status: 'DRAFT',
        publishedAt: null,
      }),
    }));
  });

  it('maps duplicate slugs within the same organization to 409', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '4.16.2',
      }),
    );

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie())
      .send({ title: 'Duplicate Slug', slug: 'duplicate-slug' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('COURSE_SLUG_TAKEN');
  });

  it('allows the same slug in different organizations', async () => {
    await authenticateAs('INSTRUCTOR', { userId: 'user-1', organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.create.mockImplementation(async ({ data }: any) =>
      courseRecord({ ...data, createdAt: now, updatedAt: now }),
    );

    const first = await request(app)
      .post('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie())
      .send({ title: 'Shared Slug', slug: 'shared-slug' });

    await authenticateAs('INSTRUCTOR', { userId: 'user-2', organizationId: 'org-b' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ userId: 'user-2', organizationId: 'org-b' }),
    );
    prismaMock.course.create.mockClear();

    const second = await request(app)
      .post('/api/v1/organizations/org-b/courses')
      .set('Cookie', cookie())
      .send({ title: 'Shared Slug', slug: 'shared-slug' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.success).toBe(true);
    expect(second.body.data.slug).toBe('shared-slug');
    expect(second.body.data.organizationId).toBe('org-b');
    expect(prismaMock.course.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: 'org-b',
        slug: 'shared-slug',
      }),
    }));
  });

  it('returns 400 when the title is missing or blank', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

    const missing = await request(app)
      .post('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie())
      .send({ description: 'no title' });

    const blank = await request(app)
      .post('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie())
      .send({ title: '   ' });

    expect(missing.status).toBe(400);
    expect(missing.body.success).toBe(false);
    expect(missing.body.error).toBe('MISSING_FIELDS');
    expect(blank.status).toBe(400);
    expect(blank.body.error).toBe('MISSING_FIELDS');
    expect(prismaMock.course.create).not.toHaveBeenCalled();
  });

  it('returns 400 for an explicitly invalid slug', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie())
      .send({ title: 'Bad Slug Course', slug: 'Invalid Slug!!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_SLUG');
    expect(prismaMock.course.create).not.toHaveBeenCalled();
  });

  it('derives a valid slug from the title when none is supplied', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.create.mockImplementation(async ({ data }: any) =>
      courseRecord({ ...data, createdAt: now, updatedAt: now }),
    );

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie())
      .send({ title: 'Advanced React & Node!' });

    expect(res.status).toBe(201);
    expect(prismaMock.course.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ slug: 'advanced-react-node' }),
    }));
    expect(res.body.data.slug).toBe('advanced-react-node');
  });

  it('auto-creates a category from the provided category name and links it to the course', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.category.findFirst.mockResolvedValue(null);
    prismaMock.category.create.mockResolvedValue({
      id: 'cat-1',
      organizationId: 'org-a',
      name: 'Dev Tools',
      slug: 'dev-tools',
      description: null,
      createdAt: now,
      updatedAt: now,
    });
    prismaMock.course.create.mockImplementation(async ({ data }: any) =>
      courseRecord({
        ...data,
        category: { id: 'cat-1', name: 'Dev Tools', slug: 'dev-tools' },
        createdAt: now,
        updatedAt: now,
      }),
    );

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie())
      .send({ title: 'Mastering Docker', category: 'Dev Tools' });

    expect(res.status).toBe(201);
    expect(res.body.data.category).toBe('Dev Tools');
    expect(res.body.data.categoryId).toBe('cat-1');
    expect(prismaMock.category.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-a',
        name: { equals: 'Dev Tools', mode: 'insensitive' },
      },
    });
    expect(prismaMock.category.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-a',
        name: 'Dev Tools',
        slug: 'dev-tools',
        description: null,
      },
    });
    expect(prismaMock.course.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ categoryId: 'cat-1' }),
    }));
  });

  it('reuses an existing category with the same name (case-insensitive) instead of creating a duplicate', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.category.findFirst.mockResolvedValue({
      id: 'cat-1',
      organizationId: 'org-a',
      name: 'Dev Tools',
      slug: 'dev-tools',
      description: null,
      createdAt: now,
      updatedAt: now,
    });
    prismaMock.course.create.mockImplementation(async ({ data }: any) =>
      courseRecord({
        ...data,
        category: { id: 'cat-1', name: 'Dev Tools', slug: 'dev-tools' },
        createdAt: now,
        updatedAt: now,
      }),
    );

    const res = await request(app)
      .post('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie())
      .send({ title: 'Mastering Docker', category: 'dev tools' });

    expect(res.status).toBe(201);
    expect(res.body.data.categoryId).toBe('cat-1');
    expect(prismaMock.category.create).not.toHaveBeenCalled();
    expect(prismaMock.course.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ categoryId: 'cat-1' }),
    }));
  });
});

describe('GET /api/v1/organizations/:organizationId/courses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/organizations/org-a/courses');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
    expect(prismaMock.course.findMany).not.toHaveBeenCalled();
  });

  it('rejects instructors with unverified email with 403', async () => {
    await authenticateAs('INSTRUCTOR', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
    expect(prismaMock.course.findMany).not.toHaveBeenCalled();
  });

  it('rejects students with 403', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({ role: 'STUDENT' }));

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
    expect(prismaMock.course.findMany).not.toHaveBeenCalled();
  });

  it('returns courses for an authorized instructor in their own organization', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findMany.mockResolvedValue([
      courseRecord({ id: 'course-1', title: 'Course One', slug: 'course-one' }),
      courseRecord({ id: 'course-2', title: 'Course Two', slug: 'course-two', status: 'PUBLISHED' }),
    ]);
    prismaMock.course.count.mockResolvedValue(2);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      id: 'course-1',
      title: 'Course One',
      slug: 'course-one',
      status: 'DRAFT',
    });
    expect(res.body.data[1]).toMatchObject({
      id: 'course-2',
      title: 'Course Two',
      slug: 'course-two',
      status: 'PUBLISHED',
    });
    expect(prismaMock.course.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-a' },
      select: expect.objectContaining({
        id: true,
        title: true,
        slug: true,
        status: true,
        difficulty: true,
        createdAt: true,
      }),
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
  });

  it('returns courses for an authorized organization admin in their own organization', async () => {
    await authenticateAs('ORG_ADMIN', { userId: 'admin-1' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({
      userId: 'admin-1',
      role: 'ORG_ADMIN',
    }));
    prismaMock.course.findMany.mockResolvedValue([
      courseRecord({ id: 'course-1', title: 'Admin Course', slug: 'admin-course' }),
    ]);
    prismaMock.course.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Admin Course');
    expect(prismaMock.course.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-a' },
      select: expect.objectContaining({
        id: true,
        title: true,
        slug: true,
        status: true,
        difficulty: true,
        createdAt: true,
      }),
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
  });

  it('rejects users whose membership belongs to another organization with 403', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-b/courses')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
    expect(prismaMock.course.findMany).not.toHaveBeenCalled();
  });

  it('returns empty array when organization has no courses', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(prismaMock.course.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-a' },
      select: expect.objectContaining({
        id: true,
        title: true,
        slug: true,
        status: true,
        difficulty: true,
        createdAt: true,
      }),
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
  });

  it('does not return courses from other organizations (cross-tenant isolation)', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findMany.mockResolvedValue([
      courseRecord({ id: 'course-1', organizationId: 'org-a', title: 'Org A Course', slug: 'org-a-course' }),
    ]);
    prismaMock.course.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].organizationId).toBeUndefined();
    expect(res.body.data[0].title).toBe('Org A Course');
    expect(prismaMock.course.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-a' },
      select: expect.objectContaining({
        id: true,
        title: true,
        slug: true,
        status: true,
        difficulty: true,
        createdAt: true,
      }),
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
  });

  it('paginates results with page/limit and returns meta', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findMany.mockResolvedValue([
      courseRecord({ id: 'course-2', title: 'Course Two', slug: 'course-two' }),
    ]);
    prismaMock.course.count.mockResolvedValue(3);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses?page=2&limit=1')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('course-2');
    expect(res.body.meta).toEqual({ page: 2, limit: 1, total: 3 });
    expect(prismaMock.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 1, take: 1 }),
    );
    expect(prismaMock.course.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-a' },
    });
  });

  it('clamps limit above the maximum of 100', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses?page=3&limit=500')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(100);
    expect(res.body.meta.page).toBe(3);
    expect(prismaMock.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 200, take: 100 }),
    );
  });

  it('filters by normalized course status', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findMany.mockResolvedValue([
      courseRecord({ id: 'course-1', title: 'Published Course', status: 'PUBLISHED' }),
    ]);
    prismaMock.course.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses?status=published')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 1 });
    expect(prismaMock.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-a', status: 'PUBLISHED' } }),
    );
    expect(prismaMock.course.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-a', status: 'PUBLISHED' },
    });
  });

  it('rejects an unknown status filter with 400', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses?status=bogus')
      .set('Cookie', cookie());

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('INVALID_STATUS');
    expect(prismaMock.course.findMany).not.toHaveBeenCalled();
  });

  it('sorts by an allowed field and order', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses?sort=title&order=asc')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(prismaMock.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { title: 'asc' } }),
    );
  });

  it('falls back to the default sort field for an unknown sort field', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/courses?sort=bogus&order=asc')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(prismaMock.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
    );
  });
});
