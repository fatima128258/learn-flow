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
  module: {
    findFirst: vi.fn(),
  },
  lesson: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
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
    title: 'PDF Lesson',
    description: null,
    content: null,
    type: 'PDF',
    resourceUrl: null,
    resourceMimeType: null,
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
  options?: { userId?: string; organizationId?: string; emailVerified?: boolean },
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
  prismaMock.lesson.findFirst.mockReset();
  prismaMock.lesson.update.mockReset();
}

async function setValidAuth() {
  await authenticateAs('INSTRUCTOR');
  prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
  prismaMock.course.findFirst.mockResolvedValue(courseRecord());
  prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
}

const BASE = '/api/v1/organizations/org-a/courses/course-1/modules/module-1/lessons';
const RESOURCE_URL = 'http://localhost:9000/learnflow/orgs/org-a/media/media-1/notes.pdf';

describe('Lesson PDF/resource attachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('persists resourceUrl and resourceMimeType when creating a lesson', async () => {
    await setValidAuth();
    prismaMock.lesson.create.mockImplementation(async ({ data }: { data?: Record<string, unknown> }) =>
      lessonRecord({ ...data, createdAt: now, updatedAt: now }),
    );

    const res = await request(app)
      .post(BASE)
      .set('Cookie', cookie())
      .send({
        title: 'PDF Lesson',
        order: 0,
        type: 'PDF',
        resourceUrl: RESOURCE_URL,
        resourceMimeType: 'application/pdf',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      type: 'PDF',
      resourceUrl: RESOURCE_URL,
      resourceMimeType: 'application/pdf',
    });
    expect(prismaMock.lesson.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        moduleId: 'module-1',
        title: 'PDF Lesson',
        order: 0,
        type: 'PDF',
        resourceUrl: RESOURCE_URL,
        resourceMimeType: 'application/pdf',
      }),
    });
  });

  it('updates resourceUrl and resourceMimeType on an existing lesson', async () => {
    await setValidAuth();
    prismaMock.lesson.findFirst.mockResolvedValue(lessonRecord());
    prismaMock.lesson.update.mockImplementation(async ({ data }: { data?: Record<string, unknown> }) =>
      lessonRecord({ ...data, createdAt: now, updatedAt: now }),
    );

    const res = await request(app)
      .patch(`${BASE}/lesson-1`)
      .set('Cookie', cookie())
      .send({ resourceUrl: RESOURCE_URL, resourceMimeType: 'application/pdf' });

    expect(res.status).toBe(200);
    expect(res.body.data.resourceUrl).toBe(RESOURCE_URL);
    expect(res.body.data.resourceMimeType).toBe('application/pdf');
    expect(prismaMock.lesson.update).toHaveBeenCalledWith({
      where: { id: 'lesson-1' },
      data: expect.objectContaining({
        resourceUrl: RESOURCE_URL,
        resourceMimeType: 'application/pdf',
      }),
    });
  });

  it('clears a resource when an empty string is sent', async () => {
    await setValidAuth();
    prismaMock.lesson.findFirst.mockResolvedValue(lessonRecord());
    prismaMock.lesson.update.mockImplementation(async ({ data }: { data?: Record<string, unknown> }) =>
      lessonRecord({ ...data, createdAt: now, updatedAt: now }),
    );

    const res = await request(app)
      .patch(`${BASE}/lesson-1`)
      .set('Cookie', cookie())
      .send({ resourceUrl: '' });

    expect(res.status).toBe(200);
    expect(prismaMock.lesson.update).toHaveBeenCalledWith({
      where: { id: 'lesson-1' },
      data: expect.objectContaining({ resourceUrl: null }),
    });
  });
});