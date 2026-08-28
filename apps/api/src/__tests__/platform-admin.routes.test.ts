import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextFunction, Response } from 'express';

const prismaMock = {
  userOrganization: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
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

vi.mock('argon2', () => ({
  default: {
    hash: vi.fn(async () => 'hashed-password'),
    argon2id: 2,
  },
}));

import app from '../server';
import * as authService from '../services/authService';
import { requireOrganizationContext, AuthenticatedRequest } from '../middleware/auth';

const now = new Date('2026-08-22T10:00:00.000Z');

function orgRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'org-1',
    name: 'Digitalsofts Academy',
    slug: 'digitalsofts-academy',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    users: [],
    ...overrides,
  };
}

function memberRecord(overrides: Record<string, unknown> = {}) {
  const user = {
    id: 'user-10',
    name: 'Sara Student',
    email: 'sara@example.com',
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
    ...(overrides.user as Record<string, unknown> | undefined),
  };
  return {
    id: 'mem-1',
    userId: 'user-10',
    organizationId: 'org-1',
    role: 'STUDENT',
    createdAt: now,
    updatedAt: now,
    ...overrides,
    user,
  };
}

async function authenticateAs(role: 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'INSTRUCTOR' | 'STUDENT', options?: {
  userId?: string;
  organizationId?: string;
}) {
  const userId = options?.userId ?? 'user-1';
  const organizationId = options?.organizationId ?? 'platform-org';

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
  prismaMock.userOrganization.findFirst.mockResolvedValue(
    role === 'PLATFORM_ADMIN' ? { role, organizationId, userId } : null,
  );
}

function cookie() {
  return ['learnflow_session=valid-token'];
}

describe('Platform Admin organization APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authorization', () => {
    it('rejects unauthenticated access to the admin dashboard', async () => {
      const res = await request(app).get('/api/v1/admin/dashboard');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('NOT_AUTHENTICATED');
    });

    it('rejects unauthenticated organization creation', async () => {
      const res = await request(app)
        .post('/api/v1/organizations')
        .send({ name: 'New Org' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('NOT_AUTHENTICATED');
      expect(prismaMock.organization.create).not.toHaveBeenCalled();
    });

    it('allows a platform admin to view the dashboard summary', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);
      prismaMock.user.count.mockResolvedValue(12);
      prismaMock.userOrganization.count.mockResolvedValue(4);

      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        organizations: { total: 3, active: 2, suspended: 1 },
        users: { total: 12 },
        organizationAdmins: { total: 4 },
      });
    });

    it('excludes the system organization from dashboard organization statistics', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(0);
      prismaMock.user.count.mockResolvedValue(12);
      prismaMock.userOrganization.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.data.organizations).toEqual({ total: 2, active: 2, suspended: 0 });
      expect(prismaMock.organization.count).toHaveBeenNthCalledWith(1, {
        where: { slug: { not: 'platform' } },
      });
      expect(prismaMock.organization.count).toHaveBeenNthCalledWith(2, {
        where: { slug: { not: 'platform' }, status: 'ACTIVE' },
      });
      expect(prismaMock.organization.count).toHaveBeenNthCalledWith(3, {
        where: { slug: { not: 'platform' }, status: 'SUSPENDED' },
      });
    });

    it('counts multiple customer organizations correctly in dashboard statistics', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);
      prismaMock.user.count.mockResolvedValue(20);
      prismaMock.userOrganization.count.mockResolvedValue(2);

      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.data.organizations).toEqual({ total: 3, active: 2, suspended: 1 });
      expect(prismaMock.user.count).toHaveBeenCalledWith();
      expect(prismaMock.userOrganization.count).toHaveBeenCalledWith({
        where: { role: 'ORG_ADMIN' },
      });
    });

    it.each(['ORG_ADMIN', 'INSTRUCTOR', 'STUDENT'] as const)('rejects %s access to platform admin APIs', async (role) => {
      await authenticateAs(role, { organizationId: 'org-a' });

      const res = await request(app)
        .get('/api/v1/organizations')
        .set('Cookie', cookie());

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('PLATFORM_ADMIN_REQUIRED');
    });

    it.each(['ORG_ADMIN', 'INSTRUCTOR', 'STUDENT'] as const)('rejects %s from creating an organization', async (role) => {
      await authenticateAs(role, { organizationId: 'org-a' });

      const res = await request(app)
        .post('/api/v1/organizations')
        .set('Cookie', cookie())
        .send({ name: 'Unauthorized Org' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('PLATFORM_ADMIN_REQUIRED');
      expect(prismaMock.organization.create).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated organization updates', async () => {
      const res = await request(app)
        .patch('/api/v1/organizations/org-1')
        .send({ name: 'Renamed Org' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('NOT_AUTHENTICATED');
      expect(prismaMock.organization.update).not.toHaveBeenCalled();
    });

    it.each(['ORG_ADMIN', 'INSTRUCTOR', 'STUDENT'] as const)('rejects %s from updating an organization', async (role) => {
      await authenticateAs(role, { organizationId: 'org-a' });

      const res = await request(app)
        .patch('/api/v1/organizations/org-1')
        .set('Cookie', cookie())
        .send({ name: 'Renamed Org' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('PLATFORM_ADMIN_REQUIRED');
      expect(prismaMock.organization.update).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated organization status changes', async () => {
      const res = await request(app)
        .patch('/api/v1/organizations/org-1/status')
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('NOT_AUTHENTICATED');
      expect(prismaMock.organization.update).not.toHaveBeenCalled();
    });

    it.each(['ORG_ADMIN', 'INSTRUCTOR', 'STUDENT'] as const)('rejects %s from changing organization status', async (role) => {
      await authenticateAs(role, { organizationId: 'org-a' });

      const res = await request(app)
        .patch('/api/v1/organizations/org-1/status')
        .set('Cookie', cookie())
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('PLATFORM_ADMIN_REQUIRED');
      expect(prismaMock.organization.update).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated organization admin assignment', async () => {
      const res = await request(app)
        .post('/api/v1/organizations/org-1/admins')
        .send({ email: 'mina@example.com' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('NOT_AUTHENTICATED');
      expect(prismaMock.userOrganization.upsert).not.toHaveBeenCalled();
    });

    it.each(['ORG_ADMIN', 'INSTRUCTOR', 'STUDENT'] as const)('rejects %s from assigning an organization admin', async (role) => {
      await authenticateAs(role, { organizationId: 'org-a' });

      const res = await request(app)
        .post('/api/v1/organizations/org-1/admins')
        .set('Cookie', cookie())
        .send({ email: 'mina@example.com' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('PLATFORM_ADMIN_REQUIRED');
      expect(prismaMock.userOrganization.upsert).not.toHaveBeenCalled();
    });
  });

  describe('organization creation and lookup', () => {
    it('creates an organization', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findUnique.mockResolvedValue(null);
      prismaMock.organization.create.mockResolvedValue(orgRecord());

      const res = await request(app)
        .post('/api/v1/organizations')
        .set('Cookie', cookie())
        .send({ name: 'Digitalsofts Academy' });

      expect(res.status).toBe(201);
      expect(res.body.data.slug).toBe('digitalsofts-academy');
      expect(res.body.data.status).toBe('ACTIVE');
      expect(prismaMock.organization.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          name: 'Digitalsofts Academy',
          slug: 'digitalsofts-academy',
          status: 'ACTIVE',
        }),
      }));
    });

    it('rejects a duplicate organization slug', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord());

      const res = await request(app)
        .post('/api/v1/organizations')
        .set('Cookie', cookie())
        .send({ name: 'Digitalsofts Academy', slug: 'digitalsofts-academy' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('ORGANIZATION_SLUG_TAKEN');
    });

    it('shows a newly created organization in the organizations listing', async () => {
      await authenticateAs('PLATFORM_ADMIN');

      prismaMock.organization.findUnique.mockResolvedValue(null);
      const created = orgRecord({
        id: 'org-new',
        name: 'Fresh Academy',
        slug: 'fresh-academy',
        status: 'ACTIVE',
        createdAt: now,
        _count: { users: 0 },
      });
      prismaMock.organization.create.mockResolvedValue(created);
      prismaMock.organization.findMany.mockResolvedValue([created]);
      prismaMock.organization.count.mockResolvedValue(1);

      const createRes = await request(app)
        .post('/api/v1/organizations')
        .set('Cookie', cookie())
        .send({ name: 'Fresh Academy' });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data).toEqual(expect.objectContaining({
        id: 'org-new',
        name: 'Fresh Academy',
        slug: 'fresh-academy',
        status: 'ACTIVE',
      }));

      const listRes = await request(app)
        .get('/api/v1/organizations')
        .set('Cookie', cookie());

      expect(listRes.status).toBe(200);
      expect(listRes.body.meta.total).toBe(1);
      expect(listRes.body.data[0]).toEqual(expect.objectContaining({
        id: 'org-new',
        name: 'Fresh Academy',
        status: 'ACTIVE',
        memberCount: 0,
      }));
    });

    it('lists organizations with pagination metadata', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findMany.mockResolvedValue([orgRecord()]);
      prismaMock.organization.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/organizations?page=1&limit=20')
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 1 });
    });

    it('excludes the system organization from the customer organization listing', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findMany.mockResolvedValue([
        orgRecord({ id: 'org-9', name: 'Customer Corp', slug: 'customer-corp', _count: { users: 4 } }),
      ]);
      prismaMock.organization.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/organizations')
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(prismaMock.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            slug: { not: 'platform' },
          }),
        })
      );
      expect(prismaMock.organization.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            slug: { not: 'platform' },
          }),
        })
      );
      const listedSlugs = res.body.data.map((org: { slug: string }) => org.slug);
      expect(listedSlugs).toEqual(['customer-corp']);
      expect(listedSlugs).not.toContain('platform');
      expect(res.body.meta.total).toBe(1);
    });

    it('still lists multiple normal customer organizations alongside the exclusion', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findMany.mockResolvedValue([
        orgRecord({ id: 'org-9', name: 'Customer Corp', slug: 'customer-corp', _count: { users: 4 } }),
        orgRecord({ id: 'org-10', name: 'Acme Learning', slug: 'acme-learning', _count: { users: 2 } }),
      ]);
      prismaMock.organization.count.mockResolvedValue(2);

      const res = await request(app)
        .get('/api/v1/organizations')
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      const listedSlugs = res.body.data.map((org: { slug: string }) => org.slug);
      expect(listedSlugs).toEqual(['customer-corp', 'acme-learning']);
      expect(res.body.meta.total).toBe(2);
    });

    it('allows a platform admin to list organizations with real database records and member counts', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findMany.mockResolvedValue([
        orgRecord({
          name: 'Digitalsofts Academy',
          status: 'ACTIVE',
          createdAt: now,
          _count: { users: 7 },
        }),
        orgRecord({
          id: 'org-2',
          name: 'Career Institute',
          slug: 'career-institute',
          status: 'SUSPENDED',
          createdAt: new Date('2026-08-01T09:00:00.000Z'),
          _count: { users: 3 },
        }),
      ]);
      prismaMock.organization.count.mockResolvedValue(2);

      const res = await request(app)
        .get('/api/v1/organizations')
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2 });
      expect(res.body.data[0]).toEqual(expect.objectContaining({
        id: 'org-1',
        name: 'Digitalsofts Academy',
        status: 'ACTIVE',
        createdAt: now.toISOString(),
        memberCount: 7,
      }));
      expect(res.body.data[1]).toEqual(expect.objectContaining({
        id: 'org-2',
        name: 'Career Institute',
        status: 'SUSPENDED',
        memberCount: 3,
      }));
      expect(prismaMock.organization.findMany).toHaveBeenCalledWith(expect.objectContaining({
        include: expect.objectContaining({
          _count: { select: { users: true } },
        }),
      }));
    });

    it('exposes organization admins from the UserOrganization relationship in the listing', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findMany.mockResolvedValue([
        orgRecord({
          users: [{
            role: 'ORG_ADMIN',
            user: { id: 'admin-1', name: 'Mina Admin', email: 'mina@example.com', emailVerified: true },
          }],
          _count: { users: 3 },
        }),
      ]);
      prismaMock.organization.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/organizations')
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.data[0].admins).toEqual([
        expect.objectContaining({
          id: 'admin-1',
          name: 'Mina Admin',
          email: 'mina@example.com',
          role: 'ORG_ADMIN',
        }),
      ]);
      expect(prismaMock.organization.findMany).toHaveBeenCalledWith(expect.objectContaining({
        include: expect.objectContaining({
          users: expect.objectContaining({ where: { role: 'ORG_ADMIN' } }),
        }),
      }));
    });

    it('does not expose non-admin memberships as organization admins', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findMany.mockResolvedValue([
        orgRecord({
          users: [{
            role: 'ORG_ADMIN',
            user: { id: 'admin-1', name: 'Mina Admin', email: 'mina@example.com', emailVerified: true },
          }],
          _count: { users: 5 },
        }),
        orgRecord({
          id: 'org-2',
          name: 'Career Institute',
          slug: 'career-institute',
          users: [],
          _count: { users: 2 },
        }),
      ]);
      prismaMock.organization.count.mockResolvedValue(2);

      const res = await request(app)
        .get('/api/v1/organizations')
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      const adminRoles = res.body.data.flatMap((org: { admins?: Array<{ role: string }> }) =>
        (org.admins ?? []).map((admin) => admin.role)
      );
      expect(adminRoles).toEqual(['ORG_ADMIN']);
      expect(res.body.data[1].admins).toEqual([]);
    });

    it('returns organization details', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord({
        users: [{
          role: 'ORG_ADMIN',
          user: { id: 'admin-1', name: 'Org Admin', email: 'org-admin@example.com', emailVerified: true },
        }],
      }));

      const res = await request(app)
        .get('/api/v1/organizations/org-1')
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('org-1');
      expect(res.body.data.admins[0].email).toBe('org-admin@example.com');
    });

    it('updates organization information', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findUnique
        .mockResolvedValueOnce(orgRecord())
        .mockResolvedValueOnce(null);
      prismaMock.organization.update.mockResolvedValue(orgRecord({ name: 'Career Institute', slug: 'career-institute' }));

      const res = await request(app)
        .patch('/api/v1/organizations/org-1')
        .set('Cookie', cookie())
        .send({ name: 'Career Institute', slug: 'career-institute' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Career Institute');
      expect(prismaMock.organization.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { name: 'Career Institute', slug: 'career-institute' },
      }));
    });

    it('rejects an update with no editable fields supplied', async () => {
      await authenticateAs('PLATFORM_ADMIN');

      const res = await request(app)
        .patch('/api/v1/organizations/org-1')
        .set('Cookie', cookie())
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_FIELDS');
      expect(prismaMock.organization.update).not.toHaveBeenCalled();
    });

    it('rejects an update with an empty organization name', async () => {
      await authenticateAs('PLATFORM_ADMIN');

      const res = await request(app)
        .patch('/api/v1/organizations/org-1')
        .set('Cookie', cookie())
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_FIELDS');
      expect(prismaMock.organization.update).not.toHaveBeenCalled();
    });

    it('shows the renamed organization in the listing after an update', async () => {
      await authenticateAs('PLATFORM_ADMIN');

      prismaMock.organization.findUnique.mockResolvedValue(
        orgRecord({ id: 'org-1', name: 'Old Name', slug: 'old-name' })
      );
      const updated = orgRecord({ id: 'org-1', name: 'New Name', slug: 'old-name', _count: { users: 4 } });
      prismaMock.organization.update.mockResolvedValue(updated);

      const patchRes = await request(app)
        .patch('/api/v1/organizations/org-1')
        .set('Cookie', cookie())
        .send({ name: 'New Name' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data).toEqual(expect.objectContaining({
        id: 'org-1',
        name: 'New Name',
      }));

      prismaMock.organization.findMany.mockResolvedValue([updated]);
      prismaMock.organization.count.mockResolvedValue(1);

      const listRes = await request(app)
        .get('/api/v1/organizations')
        .set('Cookie', cookie());

      expect(listRes.status).toBe(200);
      expect(listRes.body.data[0]).toEqual(expect.objectContaining({
        id: 'org-1',
        name: 'New Name',
        status: 'ACTIVE',
        memberCount: 4,
      }));
    });

    it('ignores client-supplied role and status on organization update', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord());
      prismaMock.organization.update.mockResolvedValue(orgRecord({ name: 'Updated Academy' }));

      const res = await request(app)
        .patch('/api/v1/organizations/org-1')
        .set('Cookie', cookie())
        .send({ name: 'Updated Academy', status: 'SUSPENDED', role: 'PLATFORM_ADMIN' });

      expect(res.status).toBe(200);
      expect(prismaMock.organization.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { name: 'Updated Academy' },
      }));
    });

    it('suspends an ACTIVE organization', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord({ status: 'ACTIVE' }));
      prismaMock.organization.update.mockResolvedValue(orgRecord({ status: 'SUSPENDED' }));

      const res = await request(app)
        .patch('/api/v1/organizations/org-1/status')
        .set('Cookie', cookie())
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SUSPENDED');
      expect(prismaMock.organization.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'org-1' },
        data: { status: 'SUSPENDED' },
      }));
    });

    it('activates a SUSPENDED organization', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord({ status: 'SUSPENDED' }));
      prismaMock.organization.update.mockResolvedValue(orgRecord({ status: 'ACTIVE' }));

      const res = await request(app)
        .patch('/api/v1/organizations/org-1/status')
        .set('Cookie', cookie())
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(prismaMock.organization.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'org-1' },
        data: { status: 'ACTIVE' },
      }));
    });

    it('reflects the new status in the organizations listing', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord({ status: 'ACTIVE' }));
      const suspended = orgRecord({ id: 'org-1', status: 'SUSPENDED', _count: { users: 2 } });
      prismaMock.organization.update.mockResolvedValue(suspended);

      const patchRes = await request(app)
        .patch('/api/v1/organizations/org-1/status')
        .set('Cookie', cookie())
        .send({ status: 'SUSPENDED' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.status).toBe('SUSPENDED');

      prismaMock.organization.findMany.mockResolvedValue([suspended]);
      prismaMock.organization.count.mockResolvedValue(1);

      const listRes = await request(app)
        .get('/api/v1/organizations')
        .set('Cookie', cookie());

      expect(listRes.status).toBe(200);
      expect(listRes.body.data[0]).toEqual(expect.objectContaining({
        id: 'org-1',
        status: 'SUSPENDED',
        memberCount: 2,
      }));
    });

    it('returns 404 when changing the status of an unknown organization', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/v1/organizations/missing-org/status')
        .set('Cookie', cookie())
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('ORGANIZATION_NOT_FOUND');
      expect(prismaMock.organization.update).not.toHaveBeenCalled();
    });
  });

  describe('organization members (read-only)', () => {
    it('lists members of an organization for a platform admin using real records', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord());
      prismaMock.userOrganization.findMany.mockResolvedValue([
        memberRecord(),
        memberRecord({
          id: 'mem-2',
          userId: 'user-11',
          organizationId: 'org-1',
          role: 'INSTRUCTOR',
          createdAt: new Date('2026-07-01T08:00:00.000Z'),
          user: {
            id: 'user-11',
            name: 'Imran Instructor',
            email: 'imran@example.com',
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          },
        }),
      ]);
      prismaMock.userOrganization.count.mockResolvedValue(2);

      const res = await request(app)
        .get('/api/v1/organizations/org-1/members')
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.organization).toEqual(expect.objectContaining({
        id: 'org-1',
        name: 'Digitalsofts Academy',
      }));
      expect(res.body.data.members).toHaveLength(2);
      expect(res.body.data.members[0]).toEqual(expect.objectContaining({
        id: 'mem-1',
        userId: 'user-10',
        organizationId: 'org-1',
        name: 'Sara Student',
        email: 'sara@example.com',
        role: 'STUDENT',
        joinedAt: now.toISOString(),
      }));
      expect(res.body.data.members[1]).toEqual(expect.objectContaining({
        id: 'mem-2',
        name: 'Imran Instructor',
        role: 'INSTRUCTOR',
      }));
      expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2 });
    });

    it('only returns memberships of the requested organization', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord());
      prismaMock.userOrganization.findMany.mockResolvedValue([memberRecord()]);
      prismaMock.userOrganization.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/organizations/org-1/members')
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(prismaMock.userOrganization.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { organizationId: 'org-1' },
      }));
      const memberOrgIds = res.body.data.members.map((member: { organizationId: string }) => member.organizationId);
      expect(memberOrgIds).toEqual(['org-1']);
      expect(memberOrgIds).not.toContain('org-2');
    });

    it('rejects unauthenticated member listing', async () => {
      const res = await request(app).get('/api/v1/organizations/org-1/members');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('NOT_AUTHENTICATED');
      expect(prismaMock.userOrganization.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1' } })
      );
    });

    it.each(['ORG_ADMIN', 'INSTRUCTOR', 'STUDENT'] as const)('rejects %s from listing organization members', async (role) => {
      await authenticateAs(role, { organizationId: 'org-a' });

      const res = await request(app)
        .get('/api/v1/organizations/org-1/members')
        .set('Cookie', cookie());

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('PLATFORM_ADMIN_REQUIRED');
      expect(prismaMock.userOrganization.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1' } })
      );
    });

    it('returns 404 for an unknown organization', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/organizations/missing-org/members')
        .set('Cookie', cookie());

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('ORGANIZATION_NOT_FOUND');
      expect(prismaMock.userOrganization.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'missing-org' } })
      );
    });
  });

  describe('organization admin assignment', () => {
    it('assigns an existing user as organization admin', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord());
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-22',
        name: 'Mina',
        email: 'mina@example.com',
        emailVerified: true,
        passwordHash: 'hash',
        createdAt: now,
        updatedAt: now,
      });
      prismaMock.userOrganization.upsert.mockResolvedValue({
        id: 'mem-1',
        userId: 'user-22',
        organizationId: 'org-1',
        role: 'ORG_ADMIN',
      });

      const res = await request(app)
        .post('/api/v1/organizations/org-1/admins')
        .set('Cookie', cookie())
        .send({ email: 'mina@example.com' });

      expect(res.status).toBe(201);
      expect(res.body.data.role).toBe('ORG_ADMIN');
      expect(res.body.data.organizationId).toBe('org-1');
      expect(res.body.data.user.email).toBe('mina@example.com');
      expect(prismaMock.userOrganization.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({
          userId: 'user-22',
          organizationId: 'org-1',
          role: 'ORG_ADMIN',
        }),
      }));
    });

    it('uses the organization id from the route and exposes no password material', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findUnique.mockResolvedValue(
        orgRecord({ id: 'org-2', name: 'Career Institute', slug: 'career-institute' })
      );
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-22',
        name: 'Mina',
        email: 'mina@example.com',
        emailVerified: true,
        passwordHash: 'hash',
        createdAt: now,
        updatedAt: now,
      });
      prismaMock.userOrganization.upsert.mockResolvedValue({
        id: 'mem-9',
        userId: 'user-22',
        organizationId: 'org-2',
        role: 'ORG_ADMIN',
      });

      const res = await request(app)
        .post('/api/v1/organizations/org-2/admins')
        .set('Cookie', cookie())
        .send({ email: 'mina@example.com' });

      expect(res.status).toBe(201);
      expect(res.body.data.organizationId).toBe('org-2');
      expect(res.body.data.role).toBe('ORG_ADMIN');
      expect(prismaMock.organization.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'org-2' } })
      );
      expect(prismaMock.userOrganization.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_organizationId: { userId: 'user-22', organizationId: 'org-2' } },
        })
      );
      expect(res.body.data.user).toEqual(
        expect.objectContaining({ id: 'user-22', email: 'mina@example.com' })
      );
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
      expect(JSON.stringify(res.body)).not.toContain('hashed-password');
    });

    it('reflects the newly assigned admin in the organizations listing', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord());
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-22',
        name: 'Mina',
        email: 'mina@example.com',
        emailVerified: true,
        passwordHash: 'hash',
        createdAt: now,
        updatedAt: now,
      });
      prismaMock.userOrganization.upsert.mockResolvedValue({
        id: 'mem-1',
        userId: 'user-22',
        organizationId: 'org-1',
        role: 'ORG_ADMIN',
      });

      const assignRes = await request(app)
        .post('/api/v1/organizations/org-1/admins')
        .set('Cookie', cookie())
        .send({ email: 'mina@example.com' });

      expect(assignRes.status).toBe(201);

      prismaMock.organization.findMany.mockResolvedValue([
        orgRecord({
          users: [{
            role: 'ORG_ADMIN',
            user: { id: 'user-22', name: 'Mina', email: 'mina@example.com', emailVerified: true },
          }],
          _count: { users: 1 },
        }),
      ]);
      prismaMock.organization.count.mockResolvedValue(1);

      const listRes = await request(app)
        .get('/api/v1/organizations')
        .set('Cookie', cookie());

      expect(listRes.status).toBe(200);
      expect(listRes.body.data[0].admins).toEqual([
        expect.objectContaining({ id: 'user-22', email: 'mina@example.com', role: 'ORG_ADMIN' }),
      ]);
    });

    it('creates a user when assigning the initial organization admin', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord());
      prismaMock.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'user-new',
          name: 'Omar',
          email: 'omar@example.com',
          emailVerified: true,
          passwordHash: 'hashed-password',
          createdAt: now,
          updatedAt: now,
        });
      prismaMock.user.create.mockResolvedValue({
        id: 'user-new',
        name: 'Omar',
        email: 'omar@example.com',
        emailVerified: false,
        passwordHash: 'hashed-password',
        createdAt: now,
        updatedAt: now,
      });
      prismaMock.user.update.mockResolvedValue({
        id: 'user-new',
        emailVerified: true,
      });
      prismaMock.userOrganization.upsert.mockResolvedValue({
        id: 'mem-2',
        userId: 'user-new',
        organizationId: 'org-1',
        role: 'ORG_ADMIN',
      });

      const res = await request(app)
        .post('/api/v1/organizations/org-1/admins')
        .set('Cookie', cookie())
        .send({
          name: 'Omar',
          email: 'omar@example.com',
          password: 'securepass123',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.id).toBe('user-new');
      expect(prismaMock.user.create).toHaveBeenCalled();
    });

    it('rejects platform admin role assignment through the org admin endpoint', async () => {
      await authenticateAs('PLATFORM_ADMIN');

      const res = await request(app)
        .post('/api/v1/organizations/org-1/admins')
        .set('Cookie', cookie())
        .send({
          email: 'attacker@example.com',
          role: 'PLATFORM_ADMIN',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ROLE_NOT_ALLOWED');
    });

    it('does not demote an existing PLATFORM_ADMIN membership', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord({ id: 'platform-org' }));
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Platform Admin',
        email: 'platform.admin@example.com',
        emailVerified: true,
        passwordHash: 'hash',
        createdAt: now,
        updatedAt: now,
      });
      prismaMock.userOrganization.findUnique.mockResolvedValue({
        id: 'mem-platform',
        userId: 'user-1',
        organizationId: 'platform-org',
        role: 'PLATFORM_ADMIN',
      });

      const res = await request(app)
        .post('/api/v1/organizations/platform-org/admins')
        .set('Cookie', cookie())
        .send({ email: 'platform.admin@example.com' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ROLE_NOT_ALLOWED');
      expect(prismaMock.userOrganization.upsert).not.toHaveBeenCalled();
    });
  });

  describe('cross-tenant access and invalid input', () => {
    it('blocks an organization admin from reading another organization via platform APIs', async () => {
      await authenticateAs('ORG_ADMIN', { userId: 'org-a-admin', organizationId: 'org-a' });

      const res = await request(app)
        .get('/api/v1/organizations/org-b')
        .set('Cookie', cookie());

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('PLATFORM_ADMIN_REQUIRED');
      expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
    });

    it('denies tenant-context access to a foreign organization (IDOR)', async () => {
      const req = {
        user: {
          id: 'org-a-user',
          name: 'Student',
          email: 'student-a@example.com',
          emailVerified: true,
          role: 'STUDENT',
          organizationId: 'org-a',
        },
        params: { organizationId: 'org-b' },
        headers: {},
        query: {},
        body: {},
      } as unknown as AuthenticatedRequest;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      prismaMock.userOrganization.findFirst.mockResolvedValue(null);
      prismaMock.userOrganization.findUnique.mockResolvedValue(null);

      await requireOrganizationContext(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect((res.json as any).mock.calls[0][0].error).toBe('ORGANIZATION_ACCESS_DENIED');
      expect(next).not.toHaveBeenCalled();
    });

    it('allows a platform admin to enter another organization context', async () => {
      const req = {
        user: {
          id: 'platform-admin',
          name: 'Platform Admin',
          email: 'admin@example.com',
          emailVerified: true,
          role: 'PLATFORM_ADMIN',
          organizationId: 'platform-org',
        },
        params: { organizationId: 'org-b' },
        headers: {},
        query: {},
        body: {},
      } as unknown as AuthenticatedRequest;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      prismaMock.userOrganization.findFirst.mockResolvedValue({
        role: 'PLATFORM_ADMIN',
        organizationId: 'platform-org',
        userId: 'platform-admin',
      });
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord({ id: 'org-b' }));

      await requireOrganizationContext(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.organizationId).toBe('org-b');
      expect(req.user?.role).toBe('PLATFORM_ADMIN');
    });

    it('rejects missing organization name', async () => {
      await authenticateAs('PLATFORM_ADMIN');

      const res = await request(app)
        .post('/api/v1/organizations')
        .set('Cookie', cookie())
        .send({ slug: 'missing-name' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_FIELDS');
    });

    it('rejects an invalid slug', async () => {
      await authenticateAs('PLATFORM_ADMIN');

      const res = await request(app)
        .post('/api/v1/organizations')
        .set('Cookie', cookie())
        .send({ name: 'Bad Org', slug: 'Invalid Slug!' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_SLUG');
    });

    it('rejects an invalid organization status', async () => {
      await authenticateAs('PLATFORM_ADMIN');

      const res = await request(app)
        .patch('/api/v1/organizations/org-1/status')
        .set('Cookie', cookie())
        .send({ status: 'DELETED' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_STATUS');
    });

    it('returns 404 for an unknown organization', async () => {
      await authenticateAs('PLATFORM_ADMIN');
      prismaMock.organization.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/organizations/missing-org')
        .set('Cookie', cookie());

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('ORGANIZATION_NOT_FOUND');
    });
  });
});
