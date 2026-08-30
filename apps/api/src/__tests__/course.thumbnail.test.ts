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
    updateMany: vi.fn(),
  },
};

vi.mock('../services/authService', () => ({
  getSessionFromToken: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock('../prisma', () => ({
  default: () => prismaMock,
}));

vi.mock('../storage', async (importOriginal) => {
  const original = await importOriginal<typeof import('../storage')>();
  return {
    ...original,
    putObject: vi.fn().mockResolvedValue({
      key: 'orgs/org-a/courses/course-1/thumbnail.png',
      publicUrl:
        'http://localhost:9000/learnflow/orgs/org-a/courses/course-1/thumbnail.png',
    }),
    deleteObjects: vi.fn().mockResolvedValue(undefined),
  };
});

import app from '../server';
import * as authService from '../services/authService';
import * as storage from '../storage';

const now = new Date('2026-08-28T12:00:00.000Z');

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
  prismaMock.course.updateMany.mockReset();
  vi.mocked(authService.getSessionFromToken).mockReset();
  vi.mocked(authService.getUserById).mockReset();
  vi.mocked(storage.putObject).mockReset();
  vi.mocked(storage.putObject).mockResolvedValue({
    key: 'orgs/org-a/courses/course-1/thumbnail.png',
    publicUrl: 'http://localhost:9000/learnflow/orgs/org-a/courses/course-1/thumbnail.png',
  });
}

async function setValidAuth(role: 'ORG_ADMIN' | 'INSTRUCTOR' | 'STUDENT' = 'INSTRUCTOR') {
  await authenticateAs(role);
  prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({ role }));
}

const THUMBNAIL_PATH = '/api/v1/organizations/org-a/courses/course-1/thumbnail';

describe('PATCH /api/v1/organizations/:organizationId/courses/:courseId/thumbnail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).patch(THUMBNAIL_PATH).attach(
      'thumbnail',
      Buffer.from('image'),
      { filename: 'cover.png', contentType: 'image/png' },
    );
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('rejects students with 403', async () => {
    await setValidAuth('STUDENT');
    const res = await request(app).patch(THUMBNAIL_PATH).set('Cookie', cookie()).attach(
      'thumbnail',
      Buffer.from('image'),
      { filename: 'cover.png', contentType: 'image/png' },
    );
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('uploads a course thumbnail and updates the course', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.course.findFirst.mockResolvedValue(
      courseRecord({ thumbnailUrl: 'http://localhost:9000/learnflow/orgs/org-a/courses/course-1/thumbnail.png' }),
    );
    prismaMock.course.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app).patch(THUMBNAIL_PATH).set('Cookie', cookie()).attach(
      'thumbnail',
      Buffer.from('image-bytes'),
      { filename: 'cover.png', contentType: 'image/png' },
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.thumbnailUrl).toContain('/orgs/org-a/courses/course-1/thumbnail.png');
    expect(vi.mocked(storage.putObject)).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'orgs/org-a/courses/course-1/thumbnail.png',
        contentType: 'image/png',
      }),
    );
    expect(prismaMock.course.updateMany).toHaveBeenCalledWith({
      where: { id: 'course-1', organizationId: 'org-a' },
      data: { thumbnailUrl: expect.stringContaining('/thumbnail.png') },
    });
  });

  it('returns 400 when no thumbnail file is attached', async () => {
    await setValidAuth('INSTRUCTOR');
    const res = await request(app).patch(THUMBNAIL_PATH).set('Cookie', cookie());
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_FILE');
  });

  it('rejects non-image files with 400', async () => {
    await setValidAuth('INSTRUCTOR');
    const res = await request(app).patch(THUMBNAIL_PATH).set('Cookie', cookie()).attach(
      'thumbnail',
      Buffer.from('%PDF'),
      { filename: 'notes.pdf', contentType: 'application/pdf' },
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MEDIA_TYPE_NOT_ALLOWED');
  });

  it('returns 404 when the course does not exist', async () => {
    await setValidAuth('INSTRUCTOR');
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app).patch(THUMBNAIL_PATH).set('Cookie', cookie()).attach(
      'thumbnail',
      Buffer.from('image'),
      { filename: 'cover.png', contentType: 'image/png' },
    );

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
  });

  it('returns 403 for cross-tenant access', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/v1/organizations/org-b/courses/course-1/thumbnail')
      .set('Cookie', cookie())
      .attach('thumbnail', Buffer.from('image'), { filename: 'cover.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
  });
});