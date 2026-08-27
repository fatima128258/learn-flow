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
  enrollment: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
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
  prismaMock.enrollment.create.mockReset();
  prismaMock.enrollment.findUnique.mockReset();
  prismaMock.enrollment.findMany.mockReset();
  prismaMock.enrollment.delete.mockReset();
  prismaMock.enrollment.count.mockReset();
}

describe('POST /api/v1/organizations/:organizationId/enrollments/:courseId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/v1/organizations/org-a/enrollments/course-1');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
    expect(prismaMock.enrollment.create).not.toHaveBeenCalled();
  });

  it('rejects students with unverified email and does not reach the service', async () => {
    await authenticateAs('STUDENT', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

    const res = await request(app)
      .post('/api/v1/organizations/org-a/enrollments/course-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
    expect(prismaMock.enrollment.create).not.toHaveBeenCalled();
  });

  it('rejects non-student roles with 403', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ role: 'INSTRUCTOR' }),
    );

    const res = await request(app)
      .post('/api/v1/organizations/org-a/enrollments/course-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
    expect(prismaMock.enrollment.create).not.toHaveBeenCalled();
  });

  it('rejects org admin with 403', async () => {
    await authenticateAs('ORG_ADMIN', { userId: 'admin-1' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ userId: 'admin-1', role: 'ORG_ADMIN' }),
    );

    const res = await request(app)
      .post('/api/v1/organizations/org-a/enrollments/course-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
    expect(prismaMock.enrollment.create).not.toHaveBeenCalled();
  });

  it('enrolls an authenticated student in a published course in their organization', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(null);
    prismaMock.enrollment.create.mockImplementation(async ({ data }: any) =>
      enrollmentRecord({ ...data, createdAt: now, updatedAt: now }),
    );

    const res = await request(app)
      .post('/api/v1/organizations/org-a/enrollments/course-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      userId: 'user-1',
      courseId: 'course-1',
      organizationId: 'org-a',
      status: 'ACTIVE',
    });
    expect(prismaMock.enrollment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-1',
        courseId: 'course-1',
        organizationId: 'org-a',
      }),
    }));
  });

  it('returns 404 when the course does not exist', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/organizations/org-a/enrollments/nonexistent')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
    expect(prismaMock.enrollment.create).not.toHaveBeenCalled();
  });

  it('returns 400 when the course is not published', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord({ status: 'DRAFT' }));

    const res = await request(app)
      .post('/api/v1/organizations/org-a/enrollments/course-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('COURSE_NOT_PUBLISHED');
    expect(prismaMock.enrollment.create).not.toHaveBeenCalled();
  });

  it('returns 409 when the student is already enrolled', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());

    const res = await request(app)
      .post('/api/v1/organizations/org-a/enrollments/course-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ALREADY_ENROLLED');
    expect(prismaMock.enrollment.create).not.toHaveBeenCalled();
  });

  it('rejects enrollment in a course from another organization', async () => {
    await authenticateAs('STUDENT', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/organizations/org-b/enrollments/course-foreign')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
    expect(prismaMock.enrollment.create).not.toHaveBeenCalled();
  });

  it('prevents client-supplied userId from enrolling another user', async () => {
    await authenticateAs('STUDENT', { userId: 'attacker-1' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ userId: 'attacker-1' }),
    );
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(null);
    prismaMock.enrollment.create.mockImplementation(async ({ data }: any) =>
      enrollmentRecord({ ...data, createdAt: now, updatedAt: now }),
    );

    const res = await request(app)
      .post('/api/v1/organizations/org-a/enrollments/course-1')
      .set('Cookie', cookie())
      .send({ userId: 'victim-1' });

    expect(res.status).toBe(201);
    expect(res.body.data.userId).toBe('attacker-1');
    expect(prismaMock.enrollment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'attacker-1',
      }),
    }));
  });

  it('prevents client-supplied organizationId from bypassing tenant isolation', async () => {
    await authenticateAs('STUDENT', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(null);
    prismaMock.enrollment.create.mockImplementation(async ({ data }: any) =>
      enrollmentRecord({ ...data, createdAt: now, updatedAt: now }),
    );

    const res = await request(app)
      .post('/api/v1/organizations/org-a/enrollments/course-1')
      .set('Cookie', cookie())
      .send({ organizationId: 'org-b' });

    expect(res.status).toBe(201);
    expect(res.body.data.organizationId).toBe('org-a');
    expect(prismaMock.enrollment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: 'org-a',
      }),
    }));
  });
});

describe('GET /api/v1/organizations/:organizationId/enrollments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .get('/api/v1/organizations/org-a/enrollments');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
    expect(prismaMock.enrollment.findMany).not.toHaveBeenCalled();
  });

  it('rejects students with unverified email with 403', async () => {
    await authenticateAs('STUDENT', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

    const res = await request(app)
      .get('/api/v1/organizations/org-a/enrollments')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
    expect(prismaMock.enrollment.findMany).not.toHaveBeenCalled();
  });

  it('rejects non-student roles with 403', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ role: 'INSTRUCTOR' }),
    );

    const res = await request(app)
      .get('/api/v1/organizations/org-a/enrollments')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
    expect(prismaMock.enrollment.findMany).not.toHaveBeenCalled();
  });

  it('returns enrollments for an authenticated student in their organization', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findMany.mockResolvedValue([
      enrollmentRecord({
        course: {
          id: 'course-1',
          title: 'Intro to Testing',
          slug: 'intro-to-testing',
          description: null,
          thumbnailUrl: null,
          category: null,
          difficulty: null,
          status: 'PUBLISHED',
          organizationId: 'org-a',
        },
      }),
    ]);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/enrollments')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      userId: 'user-1',
      courseId: 'course-1',
      status: 'ACTIVE',
    });
  });

  it('returns empty array when student has no enrollments', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/enrollments')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('rejects users whose membership belongs to another organization with 403', async () => {
    await authenticateAs('STUDENT', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-b/enrollments')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
    expect(prismaMock.enrollment.findMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/organizations/:organizationId/enrollments/:courseId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .get('/api/v1/organizations/org-a/enrollments/course-1');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('returns the enrollment for an authenticated student', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());

    const res = await request(app)
      .get('/api/v1/organizations/org-a/enrollments/course-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      userId: 'user-1',
      courseId: 'course-1',
      status: 'ACTIVE',
    });
  });

  it('returns 404 when enrollment does not exist', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/enrollments/course-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('ENROLLMENT_NOT_FOUND');
  });

  it('returns 404 when enrollment belongs to another organization', async () => {
    await authenticateAs('STUDENT', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(
      enrollmentRecord({ organizationId: 'org-b' }),
    );

    const res = await request(app)
      .get('/api/v1/organizations/org-a/enrollments/course-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('ENROLLMENT_NOT_FOUND');
  });
});

describe('DELETE /api/v1/organizations/:organizationId/enrollments/:courseId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .delete('/api/v1/organizations/org-a/enrollments/course-1');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
    expect(prismaMock.enrollment.delete).not.toHaveBeenCalled();
  });

  it('unenrolls an authenticated student from a course', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
    prismaMock.enrollment.delete.mockResolvedValue(enrollmentRecord());

    const res = await request(app)
      .delete('/api/v1/organizations/org-a/enrollments/course-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prismaMock.enrollment.delete).toHaveBeenCalledWith({
      where: {
        userId_courseId: { userId: 'user-1', courseId: 'course-1' },
      },
    });
  });

  it('returns 404 when enrollment does not exist', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/v1/organizations/org-a/enrollments/course-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('ENROLLMENT_NOT_FOUND');
    expect(prismaMock.enrollment.delete).not.toHaveBeenCalled();
  });

  it('returns 404 when enrollment belongs to another organization', async () => {
    await authenticateAs('STUDENT', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(
      enrollmentRecord({ organizationId: 'org-b' }),
    );

    const res = await request(app)
      .delete('/api/v1/organizations/org-a/enrollments/course-1')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('ENROLLMENT_NOT_FOUND');
    expect(prismaMock.enrollment.delete).not.toHaveBeenCalled();
  });
});
