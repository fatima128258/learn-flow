import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  course: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  userOrganization: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
  },
  enrollment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  module: {
    count: vi.fn(),
  },
  lesson: {
    count: vi.fn(),
  },
  quiz: {
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

const now = new Date('2026-08-28T10:00:00.000Z');

function publishedCourseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-catalog-1',
    organizationId: 'org-catalog',
    instructorUserId: 'instructor-1',
    instructorUser: { id: 'instructor-1', name: 'Dr. Instructor' },
    category: { id: 'cat-1', name: 'Development', slug: 'development' },
    title: 'LearnFlow Fundamentals',
    slug: 'learnflow-fundamentals',
    description: 'A comprehensive introduction to the LearnFlow platform.',
    thumbnailUrl: 'https://storage.local/thumb.png',
    price: 89.99,
    discountPrice: 49.99,
    status: 'PUBLISHED',
    publishedAt: now,
    estimatedMinutes: 300,
    difficulty: 'Beginner',
    learningObjectives: ['Understand tenancy', 'Build a course'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function membershipRecord(role: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'mem-1',
    userId: 'user-1',
    organizationId: 'org-catalog',
    role,
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
  const organizationId = options?.organizationId ?? 'org-catalog';
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
  prismaMock.course.findFirst.mockReset();
  prismaMock.module.count.mockReset();
  prismaMock.lesson.count.mockReset();
  prismaMock.quiz.count.mockReset();
  prismaMock.enrollment.findUnique.mockReset();
  prismaMock.userOrganization.findMany.mockReset();
  prismaMock.userOrganization.findFirst.mockReset();
  prismaMock.userOrganization.findUnique.mockReset();
}

describe('GET /api/v1/organizations/:organizationId/student/courses/:courseId/overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .get('/api/v1/organizations/org-catalog/student/courses/course-catalog-1/overview');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('rejects non-student roles with 403', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord('INSTRUCTOR'),
    );

    const res = await request(app)
      .get('/api/v1/organizations/org-catalog/student/courses/course-catalog-1/overview')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('returns course overview for a published course with counts and isEnrolled=false', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord('STUDENT'));
    prismaMock.course.findFirst.mockResolvedValue(publishedCourseRecord());
    prismaMock.module.count.mockResolvedValue(3);
    prismaMock.lesson.count.mockResolvedValue(12);
    prismaMock.quiz.count.mockResolvedValue(2);
    prismaMock.enrollment.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-catalog/student/courses/course-catalog-1/overview')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('LearnFlow Fundamentals');
    expect(res.body.data.instructor.name).toBe('Dr. Instructor');
    expect(res.body.data.category).toBe('Development');
    expect(res.body.data.price).toBe(89.99);
    expect(res.body.data.discountPrice).toBe(49.99);
    expect(res.body.data.moduleCount).toBe(3);
    expect(res.body.data.lessonCount).toBe(12);
    expect(res.body.data.quizCount).toBe(2);
    expect(res.body.data.isEnrolled).toBe(false);
  });

  it('reports isEnrolled=true when the student already has an enrollment in this org', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord('STUDENT'));
    prismaMock.course.findFirst.mockResolvedValue(publishedCourseRecord());
    prismaMock.module.count.mockResolvedValue(1);
    prismaMock.lesson.count.mockResolvedValue(4);
    prismaMock.quiz.count.mockResolvedValue(0);
    prismaMock.enrollment.findUnique.mockResolvedValue({
      id: 'enrollment-1',
      userId: 'user-1',
      courseId: 'course-catalog-1',
      organizationId: 'org-catalog',
      status: 'ACTIVE',
      enrolledAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const res = await request(app)
      .get('/api/v1/organizations/org-catalog/student/courses/course-catalog-1/overview')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.data.isEnrolled).toBe(true);
  });

  it('returns 404 when the course is not published', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord('STUDENT'));
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-catalog/student/courses/course-catalog-1/overview')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
  });

  it('does not leak a course owned by another organization (404, non-disclosing)', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord('STUDENT'));
    // The repository scopes the lookup to org-catalog; a course that belongs
    // to a different tenant is simply not found.
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-catalog/student/courses/course-from-org-b/overview')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
    expect(res.body.error).not.toBe('COURSE_PUBLISHED_IN_OTHER_ORGANIZATION');
  });
});