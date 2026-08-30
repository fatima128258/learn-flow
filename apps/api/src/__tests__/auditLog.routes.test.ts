import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  userOrganization: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
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

const now = new Date('2026-08-28T16:00:00.000Z');

function auditLogRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    organizationId: 'org-a',
    actorUserId: 'user-1',
    actorEmail: 'admin@example.com',
    actorRole: 'ORG_ADMIN',
    action: 'LOGIN',
    resourceType: 'SESSION',
    resourceId: 'session-1',
    metadata: { source: 'web' },
    ipAddress: '127.0.0.1',
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
    if (where?.role === 'ORG_ADMIN') {
      return role === 'ORG_ADMIN' ? { role, organizationId, userId } : null;
    }
    return null;
  });

  prismaMock.userOrganization.findUnique.mockImplementation(async ({ where }: { where?: { role?: string; organizationId?: string; userId?: string; id?: string; courseId?: string; moduleId?: string; quizId?: string; status?: string; userId_organizationId?: { userId?: string; organizationId?: string } } }) => {
    if (where?.userId_organizationId?.organizationId === organizationId) {
      return { role, organizationId, userId };
    }
    return null;
  });
}

function cookie() {
  return ['learnflow_session=valid-token'];
}

function resetMocks() {
  Object.values(prismaMock.userOrganization).forEach((fn) => vi.mocked(fn).mockReset());
  prismaMock.auditLog.findMany.mockReset();
  prismaMock.auditLog.count.mockReset();
  prismaMock.auditLog.create.mockReset();
}

describe('Audit log read endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  describe('GET /api/v1/admin/audit-logs', () => {
    it('rejects unauthenticated access', async () => {
      const res = await request(app).get('/api/v1/admin/audit-logs');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('NOT_AUTHENTICATED');
      expect(prismaMock.auditLog.findMany).not.toHaveBeenCalled();
    });

    it('rejects a non-platform-admin with 403', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });

      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Cookie', cookie());

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('PLATFORM_ADMIN_REQUIRED');
      expect(prismaMock.auditLog.findMany).not.toHaveBeenCalled();
    });

    it('lists audit logs with pagination meta and a full DTO', async () => {
      await authenticateAs('PLATFORM_ADMIN', { organizationId: 'platform-org' });
      prismaMock.auditLog.findMany.mockResolvedValue([auditLogRecord()]);
      prismaMock.auditLog.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 1 });
      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(prismaMock.auditLog.count).toHaveBeenCalledWith({ where: {} });

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toEqual({
        id: 'log-1',
        action: 'LOGIN',
        organizationId: 'org-a',
        actor: {
          userId: 'user-1',
          email: 'admin@example.com',
          role: 'ORG_ADMIN',
        },
        resource: {
          type: 'SESSION',
          id: 'session-1',
        },
        metadata: { source: 'web' },
        ipAddress: '127.0.0.1',
        createdAt: now.toISOString(),
      });
    });

    it('applies pagination options from the query string', async () => {
      await authenticateAs('PLATFORM_ADMIN', { organizationId: 'platform-org' });
      prismaMock.auditLog.findMany.mockResolvedValue([]);
      prismaMock.auditLog.count.mockResolvedValue(0);

      const res = await request(app)
        .get('/api/v1/admin/audit-logs?page=3&limit=5')
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.meta).toEqual({ page: 3, limit: 5, total: 0 });
      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });

    it('filters audit logs by organization for platform admins', async () => {
      await authenticateAs('PLATFORM_ADMIN', { organizationId: 'platform-org' });
      prismaMock.auditLog.findMany.mockResolvedValue([]);
      prismaMock.auditLog.count.mockResolvedValue(0);

      const res = await request(app)
        .get('/api/v1/admin/audit-logs?organizationId=org-b')
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-b' } }),
      );
      expect(prismaMock.auditLog.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-b' } }),
      );
    });

    it('applies action and date range filters', async () => {
      await authenticateAs('PLATFORM_ADMIN', { organizationId: 'platform-org' });
      prismaMock.auditLog.findMany.mockResolvedValue([]);
      prismaMock.auditLog.count.mockResolvedValue(0);

      const res = await request(app)
        .get(
          '/api/v1/admin/audit-logs?action=COURSE_PUBLISHED&from=2026-08-01T00:00:00.000Z&to=2026-08-31T00:00:00.000Z',
        )
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            action: 'COURSE_PUBLISHED',
            createdAt: {
              gte: new Date('2026-08-01T00:00:00.000Z'),
              lte: new Date('2026-08-31T00:00:00.000Z'),
            },
          },
        }),
      );
    });

    it('rejects an invalid date filter with 400', async () => {
      await authenticateAs('PLATFORM_ADMIN', { organizationId: 'platform-org' });

      const res = await request(app)
        .get('/api/v1/admin/audit-logs?from=not-a-date')
        .set('Cookie', cookie());

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_DATE_FILTER');
    });

    it('rejects a non-string filter with 400', async () => {
      await authenticateAs('PLATFORM_ADMIN', { organizationId: 'platform-org' });

      const res = await request(app)
        .get('/api/v1/admin/audit-logs?action[0]=LOGIN')
        .set('Cookie', cookie());

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_FILTER');
    });
  });

  describe('GET /api/v1/org/audit-logs', () => {
    it('rejects unauthenticated access', async () => {
      const res = await request(app).get('/api/v1/org/audit-logs');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('NOT_AUTHENTICATED');
    });

    it('rejects a non-org-admin with 403', async () => {
      await authenticateAs('STUDENT', { organizationId: 'org-a' });

      const res = await request(app)
        .get('/api/v1/org/audit-logs')
        .set('Cookie', cookie());

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ORG_ADMIN_REQUIRED');
    });

    it('rejects a platform admin from the org endpoint', async () => {
      await authenticateAs('PLATFORM_ADMIN', { organizationId: 'platform-org' });

      const res = await request(app)
        .get('/api/v1/org/audit-logs')
        .set('Cookie', cookie());

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ORG_ADMIN_REQUIRED');
    });

    it('lists only the authenticated tenant, ignoring client-supplied org ids', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });
      prismaMock.auditLog.findMany.mockResolvedValue([auditLogRecord()]);
      prismaMock.auditLog.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/org/audit-logs?organizationId=org-b&action=LOGIN')
        .set('Cookie', cookie())
        .set('X-Organization-Id', 'org-b');

      expect(res.status).toBe(200);
      expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 1 });
      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-a', action: 'LOGIN' },
        }),
      );
      expect(res.body.data[0].actor.userId).toBe('user-1');
    });
  });
});