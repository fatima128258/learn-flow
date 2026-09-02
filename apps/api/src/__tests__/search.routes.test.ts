import request from 'supertest';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

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
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  enrollment: {
    findUnique: vi.fn(),
  },
};

vi.mock('../services/authService', () => ({
  getSessionFromToken: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock('../prisma', () => ({
  default: () => prismaMock,
}));

vi.mock('../repositories/enrollmentRepository', () => ({
  findByUserAndCourse: vi.fn(async () => null),  // Default: not enrolled
}));

import app from '../server';
import * as authService from '../services/authService';

const now = new Date('2026-08-28T14:00:00.000Z');

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

function searchableCourse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    organizationId: 'org-a',
    instructorUserId: 'instructor-1',
    instructorUser: { id: 'instructor-1', name: 'Instructor One' },
    title: 'React Fundamentals',
    slug: 'react-fundamentals',
    description: 'Learn React from scratch with modern hooks.',
    thumbnailUrl: null,
    category: 'Development',
    difficulty: 'Beginner',
    price: 49,
    discountPrice: null,
    estimatedMinutes: 600,
    learningObjectives: [],
    status: 'PUBLISHED',
    publishedAt: now,
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
    name: 'Student User',
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
    membershipRecord({ role, organizationId, userId })
  );

  // Mock enrollment to always return null (not enrolled) by default
  prismaMock.enrollment.findUnique.mockResolvedValue(null);
}

function cookie() {
  return ['learnflow_session=valid-token'];
}

function resetMocks() {
  prismaMock.userOrganization.findMany.mockReset();
  prismaMock.userOrganization.findFirst.mockReset();
  prismaMock.userOrganization.findUnique.mockReset();
  prismaMock.organization.findUnique.mockReset();
  prismaMock.course.findMany.mockReset();
  prismaMock.course.findFirst.mockReset();
  prismaMock.course.count.mockReset();
  prismaMock.enrollment.findUnique.mockReset();
  vi.mocked(authService.getSessionFromToken).mockReset();
  vi.mocked(authService.getUserById).mockReset();
}

const SEARCH_PATH = '/api/v1/organizations/org-a/student/search';

describe('GET /api/v1/organizations/:organizationId/student/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get(SEARCH_PATH);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('rejects students with unverified email with 403', async () => {
    await authenticateAs('STUDENT', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

    const res = await request(app).get(SEARCH_PATH).set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
  });

  it('rejects non-student roles with 403', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ role: 'INSTRUCTOR' }),
    );

    const res = await request(app).get(SEARCH_PATH).set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('returns 403 for cross-tenant organization access', async () => {
    await authenticateAs('STUDENT', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-b/student/search')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
  });

  it('searches published courses within the tenant by title and description', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findMany.mockResolvedValue([searchableCourse()]);
    prismaMock.course.count.mockResolvedValue(1);

    const res = await request(app)
      .get(`${SEARCH_PATH}?q=react`)
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: 'course-1',
      title: 'React Fundamentals',
      description: 'Learn React from scratch with modern hooks.',
      category: 'Development',
      difficulty: 'Beginner',
      status: 'PUBLISHED',
      instructor: { id: 'instructor-1', name: 'Instructor One' },
    });

    const findManyArgs = prismaMock.course.findMany.mock.calls[0][0];
    expect(findManyArgs.where.organizationId).toBe('org-a');
    expect(findManyArgs.where.status).toBe('PUBLISHED');
    expect(findManyArgs.where.OR).toEqual([
      { title: { contains: 'react', mode: 'insensitive' } },
      { description: { contains: 'react', mode: 'insensitive' } },
    ]);
    expect(findManyArgs.include.instructorUser).toBeDefined();
  });

  it('never queries unpublished courses (published status enforced server-side)', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findMany.mockResolvedValue([
      searchableCourse(),
      searchableCourse({ id: 'course-2', title: 'Hidden Draft', status: 'DRAFT' }),
    ]);
    prismaMock.course.count.mockResolvedValue(2);

    const res = await request(app).get(`${SEARCH_PATH}?q=react`).set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(prismaMock.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PUBLISHED' }),
      }),
    );
    expect(res.body.data).toHaveLength(2);
  });

  it('filters by category and difficulty when provided', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findMany.mockResolvedValue([searchableCourse()]);
    prismaMock.course.count.mockResolvedValue(1);

    const res = await request(app)
      .get(`${SEARCH_PATH}?category=Development&difficulty=Beginner`)
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    const args = prismaMock.course.findMany.mock.calls[0][0];
    expect(args.where.category).toEqual({ name: 'Development' });
    expect(args.where.difficulty).toBe('Beginner');
  });

  it('returns an empty list when no courses match', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);

    const res = await request(app)
      .get(`${SEARCH_PATH}?q=nonexistent`)
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('paginates search results and returns meta', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findMany.mockResolvedValue([
      searchableCourse({ id: 'course-2', title: 'React Advanced', slug: 'react-advanced' }),
    ]);
    prismaMock.course.count.mockResolvedValue(25);

    const res = await request(app)
      .get(`${SEARCH_PATH}?q=react&page=3&limit=5`)
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('course-2');
    expect(res.body.meta).toEqual({ page: 3, limit: 5, total: 25 });
    const args = prismaMock.course.findMany.mock.calls[0][0];
    expect(args.skip).toBe(10);
    expect(args.take).toBe(5);
    expect(prismaMock.course.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PUBLISHED' }),
      }),
    );
  });

  it('filters by instructor name when provided', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findMany.mockResolvedValue([searchableCourse()]);
    prismaMock.course.count.mockResolvedValue(1);

    const res = await request(app)
      .get(`${SEARCH_PATH}?instructor=smith`)
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    const args = prismaMock.course.findMany.mock.calls[0][0];
    expect(args.where.instructorUser).toEqual({
      is: { name: { contains: 'smith', mode: 'insensitive' } },
    });
  });

  it('filters by discount price when a discount is set', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findMany.mockResolvedValue([searchableCourse()]);
    prismaMock.course.count.mockResolvedValue(1);

    const res = await request(app)
      .get(`${SEARCH_PATH}?minPrice=10&maxPrice=60`)
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    const findManyArgs = prismaMock.course.findMany.mock.calls[0][0];
    expect(findManyArgs.where.OR).toContainEqual({
      discountPrice: { not: null, gte: 10, lte: 60 },
    });
    const countArgs = prismaMock.course.count.mock.calls[0][0];
    expect(countArgs.where.OR).toContainEqual({
      discountPrice: null,
      price: { gte: 10, lte: 60 },
    });
  });

  it('applies price bounds individually when only one is provided', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);

    const res = await request(app).get(`${SEARCH_PATH}?minPrice=25`).set('Cookie', cookie());

    expect(res.status).toBe(200);
    const args = prismaMock.course.findMany.mock.calls[0][0];
    expect(args.where.OR).toContainEqual({
      discountPrice: { not: null, gte: 25 },
    });
  });

  it('rejects a nonsensical price range with 400', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

    const res = await request(app)
      .get(`${SEARCH_PATH}?minPrice=100&maxPrice=10`)
      .set('Cookie', cookie());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_QUERY');
  });

  it('rejects non-numeric or negative price bounds with 400', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

    const res = await request(app)
      .get(`${SEARCH_PATH}?minPrice=abc`)
      .set('Cookie', cookie());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_QUERY');

    const negative = await request(app)
      .get(`${SEARCH_PATH}?maxPrice=-5`)
      .set('Cookie', cookie());

    expect(negative.status).toBe(400);
    expect(negative.body.error).toBe('INVALID_QUERY');
  });

  it('sorts search results by an allowed field and order', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findMany.mockResolvedValue([searchableCourse()]);
    prismaMock.course.count.mockResolvedValue(1);

    const res = await request(app)
      .get(`${SEARCH_PATH}?q=react&sort=title&order=asc`)
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    const args = prismaMock.course.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ title: 'asc' });
  });

  it('defaults search sort and pagination when not provided', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findMany.mockResolvedValue([searchableCourse()]);
    prismaMock.course.count.mockResolvedValue(1);

    const res = await request(app).get(`${SEARCH_PATH}?q=react`).set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 1 });
    const args = prismaMock.course.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ publishedAt: 'desc' });
    expect(args.skip).toBe(0);
    expect(args.take).toBe(20);
  });
});

describe('REGRESSION TESTS: Critical Search Feature Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  describe('Exact Match Search', () => {
    it('returns course when exact title matches (case-insensitive)', async () => {
      await authenticateAs('STUDENT');
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
      prismaMock.course.findMany.mockResolvedValue([
        searchableCourse({
          id: 'course-exact',
          title: 'React Fundamentals',
          slug: 'react-fundamentals',
        }),
      ]);
      prismaMock.course.count.mockResolvedValue(1);

      const res = await request(app)
        .get(`${SEARCH_PATH}?q=React%20Fundamentals`)
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('React Fundamentals');
      
      // Verify query was case-insensitive
      const args = prismaMock.course.findMany.mock.calls[0][0];
      expect(args.where.OR[0].title.mode).toBe('insensitive');
    });

    it('returns course when exact title matches (different case)', async () => {
      await authenticateAs('STUDENT');
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
      prismaMock.course.findMany.mockResolvedValue([
        searchableCourse({
          id: 'course-1',
          title: 'React Fundamentals',
        }),
      ]);
      prismaMock.course.count.mockResolvedValue(1);

      const res = await request(app)
        .get(`${SEARCH_PATH}?q=REACT%20FUNDAMENTALS`)
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('Partial Match Search', () => {
    it('returns courses with partial title match', async () => {
      await authenticateAs('STUDENT');
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
      prismaMock.course.findMany.mockResolvedValue([
        searchableCourse({
          id: 'course-1',
          title: 'React Fundamentals',
        }),
        searchableCourse({
          id: 'course-2',
          title: 'React Advanced',
          slug: 'react-advanced',
        }),
      ]);
      prismaMock.course.count.mockResolvedValue(2);

      const res = await request(app)
        .get(`${SEARCH_PATH}?q=react`)
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.map((c: any) => c.title)).toContain('React Fundamentals');
      expect(res.body.data.map((c: any) => c.title)).toContain('React Advanced');
    });

    it('returns courses with partial description match', async () => {
      await authenticateAs('STUDENT');
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
      prismaMock.course.findMany.mockResolvedValue([
        searchableCourse({
          id: 'course-1',
          title: 'Web Development Basics',
          description: 'Learn the fundamentals of web development',
        }),
      ]);
      prismaMock.course.count.mockResolvedValue(1);

      const res = await request(app)
        .get(`${SEARCH_PATH}?q=fundamentals`)
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].description).toContain('fundamentals');
    });
  });

  describe('Whitespace & Case Handling', () => {
    it('trims leading and trailing spaces from query', async () => {
      await authenticateAs('STUDENT');
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
      prismaMock.course.findMany.mockResolvedValue([searchableCourse()]);
      prismaMock.course.count.mockResolvedValue(1);

      const res = await request(app)
        .get(`${SEARCH_PATH}?q=%20%20react%20%20`)
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      // Verify that the query was trimmed before being used
      const args = prismaMock.course.findMany.mock.calls[0][0];
      expect(args.where.OR[0].title.contains).toBe('react');
    });

    it('treats whitespace-only query as empty', async () => {
      await authenticateAs('STUDENT');
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
      prismaMock.course.findMany.mockResolvedValue([]);
      prismaMock.course.count.mockResolvedValue(0);

      const res = await request(app)
        .get(`${SEARCH_PATH}?q=%20%20%20`)
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      // Verify that no OR clause was added (query was treated as undefined)
      const args = prismaMock.course.findMany.mock.calls[0][0];
      expect(args.where.OR).toBeUndefined();
    });
  });

  describe('Organization Isolation', () => {
    it('only returns courses from the requested organization', async () => {
      await authenticateAs('STUDENT', { organizationId: 'org-a' });
      prismaMock.userOrganization.findUnique.mockResolvedValue(
        membershipRecord({ organizationId: 'org-a' })
      );
      prismaMock.course.findMany.mockResolvedValue([
        searchableCourse({ organizationId: 'org-a' }),
      ]);
      prismaMock.course.count.mockResolvedValue(1);

      const res = await request(app)
        .get(`${SEARCH_PATH}?q=react`)
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      // Verify organizationId filter was applied
      const args = prismaMock.course.findMany.mock.calls[0][0];
      expect(args.where.organizationId).toBe('org-a');
      expect(res.body.data[0].organizationId).toBe('org-a');
    });

    it('prevents cross-organization search access', async () => {
      await authenticateAs('STUDENT', { organizationId: 'org-a' });
      prismaMock.userOrganization.findUnique.mockResolvedValue(null); // User not in org-b

      const res = await request(app)
        .get('/api/v1/organizations/org-b/student/search?q=react')
        .set('Cookie', cookie());

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
    });
  });

  describe('Published Course Visibility', () => {
    it('only returns published courses', async () => {
      await authenticateAs('STUDENT');
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
      prismaMock.course.findMany.mockResolvedValue([
        searchableCourse({ status: 'PUBLISHED' }),
      ]);
      prismaMock.course.count.mockResolvedValue(1);

      const res = await request(app)
        .get(`${SEARCH_PATH}?q=react`)
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      // Verify status filter was applied
      const args = prismaMock.course.findMany.mock.calls[0][0];
      expect(args.where.status).toBe('PUBLISHED');
    });

    it('never returns draft courses in search results', async () => {
      await authenticateAs('STUDENT');
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
      prismaMock.course.findMany.mockResolvedValue([]); // No results because status filter blocks drafts
      prismaMock.course.count.mockResolvedValue(0);

      const res = await request(app)
        .get(`${SEARCH_PATH}?q=draft-course`)
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      // Verify status was checked
      const args = prismaMock.course.findMany.mock.calls[0][0];
      expect(args.where.status).toBe('PUBLISHED');
    });
  });

  describe('Unauthorized Access Prevention', () => {
    it('blocks unauthenticated users', async () => {
      const res = await request(app).get(SEARCH_PATH);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('NOT_AUTHENTICATED');
    });

    it('blocks users with unverified emails', async () => {
      await authenticateAs('STUDENT', { emailVerified: false });
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

      const res = await request(app).get(SEARCH_PATH).set('Cookie', cookie());

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
    });

    it('blocks non-student roles', async () => {
      await authenticateAs('INSTRUCTOR');
      prismaMock.userOrganization.findUnique.mockResolvedValue(
        membershipRecord({ role: 'INSTRUCTOR' })
      );

      const res = await request(app).get(SEARCH_PATH).set('Cookie', cookie());

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('Search Result Accuracy', () => {
    it('returns enrollment status for each course', async () => {
      await authenticateAs('STUDENT');
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
      prismaMock.course.findMany.mockResolvedValue([
        searchableCourse({ id: 'course-1' }),
      ]);
      prismaMock.course.count.mockResolvedValue(1);
      prismaMock.enrollment.findUnique.mockResolvedValue(null); // Not enrolled

      const res = await request(app)
        .get(`${SEARCH_PATH}?q=react`)
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.data[0]).toHaveProperty('isEnrolled');
      expect(res.body.data[0].isEnrolled).toBe(false);
    });

    it('includes all course metadata in results', async () => {
      await authenticateAs('STUDENT');
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
      prismaMock.course.findMany.mockResolvedValue([searchableCourse()]);
      prismaMock.course.count.mockResolvedValue(1);

      const res = await request(app)
        .get(`${SEARCH_PATH}?q=react`)
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      const course = res.body.data[0];
      expect(course).toHaveProperty('id');
      expect(course).toHaveProperty('title');
      expect(course).toHaveProperty('description');
      expect(course).toHaveProperty('category');
      expect(course).toHaveProperty('difficulty');
      expect(course).toHaveProperty('price');
      expect(course).toHaveProperty('instructor');
      expect(course).toHaveProperty('isEnrolled');
    });
  });

  describe('Stale Result Prevention', () => {
    it('does not cache search results between requests', async () => {
      await authenticateAs('STUDENT');
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

      // First search
      prismaMock.course.findMany.mockResolvedValueOnce([
        searchableCourse({ id: 'course-1', title: 'React Basics' }),
      ]);
      prismaMock.course.count.mockResolvedValueOnce(1);

      const res1 = await request(app)
        .get(`${SEARCH_PATH}?q=react`)
        .set('Cookie', cookie());

      expect(res1.body.data).toHaveLength(1);
      expect(res1.body.data[0].title).toBe('React Basics');

      // Second search with different query
      prismaMock.course.findMany.mockResolvedValueOnce([
        searchableCourse({ id: 'course-2', title: 'JavaScript Advanced' }),
      ]);
      prismaMock.course.count.mockResolvedValueOnce(1);

      const res2 = await request(app)
        .get(`${SEARCH_PATH}?q=javascript`)
        .set('Cookie', cookie());

      expect(res2.body.data).toHaveLength(1);
      expect(res2.body.data[0].title).toBe('JavaScript Advanced');
      // Verify different query was used
      expect(prismaMock.course.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('Empty Results Handling', () => {
    it('returns empty array when no courses match search', async () => {
      await authenticateAs('STUDENT');
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
      prismaMock.course.findMany.mockResolvedValue([]);
      prismaMock.course.count.mockResolvedValue(0);

      const res = await request(app)
        .get(`${SEARCH_PATH}?q=nonexistent-course`)
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('returns all published courses when search query is empty', async () => {
      await authenticateAs('STUDENT');
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
      prismaMock.course.findMany.mockResolvedValue([
        searchableCourse({ id: 'course-1' }),
        searchableCourse({ id: 'course-2', title: 'Course Two' }),
      ]);
      prismaMock.course.count.mockResolvedValue(2);

      const res = await request(app)
        .get(`${SEARCH_PATH}`)
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });
  });
});
