import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  userOrganization: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  category: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
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

const now = new Date('2026-08-29T10:00:00.000Z');

function categoryRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cat-1',
    organizationId: 'org-a',
    name: 'Web Development',
    slug: 'web-development',
    description: 'Web-focused courses',
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
    if (where?.role === 'ORG_ADMIN') {
      return role === 'ORG_ADMIN' ? { role, organizationId, userId } : null;
    }
    return null;
  });

  prismaMock.userOrganization.findUnique.mockResolvedValue({
    id: 'mem-1',
    userId,
    organizationId,
    role,
    createdAt: now,
    updatedAt: now,
  });
}

function cookie() {
  return ['learnflow_session=valid-token'];
}

function resetMocks() {
  Object.values(prismaMock.userOrganization).forEach((fn) => (fn as any).mockReset());
  prismaMock.category.create.mockReset();
  prismaMock.category.findMany.mockReset();
  prismaMock.category.findFirst.mockReset();
  prismaMock.category.updateMany.mockReset();
  prismaMock.category.deleteMany.mockReset();
}

describe('Org-admin category endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  describe('GET /api/v1/org/categories', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/org/categories');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('NOT_AUTHENTICATED');
      expect(prismaMock.category.findMany).not.toHaveBeenCalled();
    });

    it('rejects non-org-admin roles with 403', async () => {
      await authenticateAs('INSTRUCTOR');

      const res = await request(app)
        .get('/api/v1/org/categories')
        .set('Cookie', cookie());

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ORG_ADMIN_REQUIRED');
      expect(prismaMock.category.findMany).not.toHaveBeenCalled();
    });

    it('lists categories scoped to the org admin tenant with course counts', async () => {
      await authenticateAs('ORG_ADMIN');
      prismaMock.category.findMany.mockResolvedValue([
        { ...categoryRecord(), _count: { courses: 3 } },
        {
          ...categoryRecord({ id: 'cat-2', name: 'Data Science', slug: 'data-science', description: null }),
          _count: { courses: 0 },
        },
      ]);

      const res = await request(app)
        .get('/api/v1/org/categories')
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prismaMock.category.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-a' },
        include: {
          _count: { select: { courses: true } },
        },
        orderBy: [{ name: 'asc' }],
      });
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toEqual({
        id: 'cat-1',
        organizationId: 'org-a',
        name: 'Web Development',
        slug: 'web-development',
        description: 'Web-focused courses',
        courseCount: 3,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    });
  });

  describe('POST /api/v1/org/categories', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/v1/org/categories')
        .send({ name: 'Dev Tools' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('NOT_AUTHENTICATED');
      expect(prismaMock.category.create).not.toHaveBeenCalled();
    });

    it('rejects a non-org-admin role with 403', async () => {
      await authenticateAs('STUDENT');

      const res = await request(app)
        .post('/api/v1/org/categories')
        .set('Cookie', cookie())
        .send({ name: 'Dev Tools' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ORG_ADMIN_REQUIRED');
      expect(prismaMock.category.create).not.toHaveBeenCalled();
    });

    it('returns 400 when the name is missing or blank', async () => {
      await authenticateAs('ORG_ADMIN');

      const missing = await request(app)
        .post('/api/v1/org/categories')
        .set('Cookie', cookie())
        .send({});

      const blank = await request(app)
        .post('/api/v1/org/categories')
        .set('Cookie', cookie())
        .send({ name: '   ' });

      expect(missing.status).toBe(400);
      expect(missing.body.error).toBe('MISSING_FIELDS');
      expect(blank.status).toBe(400);
      expect(blank.body.error).toBe('MISSING_FIELDS');
      expect(prismaMock.category.create).not.toHaveBeenCalled();
    });

    it('creates a category with a derived slug and assigns it to the admin tenant', async () => {
      await authenticateAs('ORG_ADMIN');
      prismaMock.category.findFirst.mockResolvedValue(null);
      prismaMock.category.create.mockResolvedValue(categoryRecord());

      const res = await request(app)
        .post('/api/v1/org/categories')
        .set('Cookie', cookie())
        .send({ name: 'Web Development & Design', description: 'Web-focused courses' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(prismaMock.category.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-a',
          name: 'Web Development & Design',
          slug: 'web-development-design',
          description: 'Web-focused courses',
        },
      });
      expect(res.body.data).toEqual({
        id: 'cat-1',
        organizationId: 'org-a',
        name: 'Web Development',
        slug: 'web-development',
        description: 'Web-focused courses',
        courseCount: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    });

    it('rejects duplicate category names within the same organization with 409', async () => {
      await authenticateAs('ORG_ADMIN');
      prismaMock.category.findFirst.mockResolvedValue(
        categoryRecord({ id: 'cat-2', name: 'Web Development' }),
      );

      const res = await request(app)
        .post('/api/v1/org/categories')
        .set('Cookie', cookie())
        .send({ name: 'web development' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('CATEGORY_NAME_TAKEN');
      expect(prismaMock.category.create).not.toHaveBeenCalled();
    });

    it('allows the same category name in a different organization', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-b' });
      prismaMock.category.findFirst.mockResolvedValue(null);
      prismaMock.category.create.mockResolvedValue(
        categoryRecord({ id: 'cat-3', organizationId: 'org-b' }),
      );

      const res = await request(app)
        .post('/api/v1/org/categories')
        .set('Cookie', cookie())
        .send({ name: 'Web Development' });

      expect(res.status).toBe(201);
      expect(prismaMock.category.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-b',
          name: 'Web Development',
          slug: 'web-development',
          description: null,
        },
      });
      expect(res.body.data.organizationId).toBe('org-b');
    });
  });

  describe('PATCH /api/v1/org/categories/:categoryId', () => {
    it('updates the category name and regenerates its slug', async () => {
      await authenticateAs('ORG_ADMIN');
      prismaMock.category.findFirst
        .mockResolvedValueOnce(categoryRecord())
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(categoryRecord({ name: 'Frontend', slug: 'frontend' }));
      prismaMock.category.updateMany.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .patch('/api/v1/org/categories/cat-1')
        .set('Cookie', cookie())
        .send({ name: 'Frontend' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Frontend');
      expect(res.body.data.slug).toBe('frontend');
      expect(prismaMock.category.updateMany).toHaveBeenCalledWith({
        where: { id: 'cat-1', organizationId: 'org-a' },
        data: { name: 'Frontend', slug: 'frontend', description: 'Web-focused courses' },
      });
    });

    it('rejects renaming to an existing name with 409', async () => {
      await authenticateAs('ORG_ADMIN');
      prismaMock.category.findFirst
        .mockResolvedValueOnce(categoryRecord({ name: 'Web' }))
        .mockResolvedValueOnce(categoryRecord({ id: 'cat-2', name: 'Frontend' }));

      const res = await request(app)
        .patch('/api/v1/org/categories/cat-1')
        .set('Cookie', cookie())
        .send({ name: 'Frontend' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('CATEGORY_NAME_TAKEN');
      expect(prismaMock.category.updateMany).not.toHaveBeenCalled();
    });

    it('returns 404 when the category does not exist in the tenant', async () => {
      await authenticateAs('ORG_ADMIN');
      prismaMock.category.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/v1/org/categories/missing')
        .set('Cookie', cookie())
        .send({ name: 'Frontend' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('CATEGORY_NOT_FOUND');
      expect(prismaMock.category.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/v1/org/categories/:categoryId', () => {
    it('deletes a category in the admin tenant', async () => {
      await authenticateAs('ORG_ADMIN');
      prismaMock.category.deleteMany.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .delete('/api/v1/org/categories/cat-1')
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, deleted: true });
      expect(prismaMock.category.deleteMany).toHaveBeenCalledWith({
        where: { id: 'cat-1', organizationId: 'org-a' },
      });
    });

    it('cannot delete a category from another tenant (404 cross-tenant isolation)', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-b' });
      prismaMock.category.deleteMany.mockResolvedValue({ count: 0 });

      const res = await request(app)
        .delete('/api/v1/org/categories/cat-1')
        .set('Cookie', cookie());

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('CATEGORY_NOT_FOUND');
      expect(prismaMock.category.deleteMany).toHaveBeenCalledWith({
        where: { id: 'cat-1', organizationId: 'org-b' },
      });
    });
  });
});