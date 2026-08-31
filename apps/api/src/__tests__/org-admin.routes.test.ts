import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  userOrganization: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
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

const now = new Date('2026-08-22T10:00:00.000Z');

function orgRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'org-a',
    name: 'Academy A',
    slug: 'academy-a',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    users: [],
    ...overrides,
  };
}

function membershipRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mem-1',
    userId: 'instructor-1',
    organizationId: 'org-a',
    role: 'INSTRUCTOR',
    createdAt: now,
    updatedAt: now,
    user: {
      id: 'instructor-1',
      name: 'Ira Instructor',
      email: 'ira@example.com',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
    ...overrides,
  };
}

async function authenticateAs(role: 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'INSTRUCTOR' | 'STUDENT', options?: {
  userId?: string;
  organizationId?: string;
}) {
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
}

function cookie() {
  return ['learnflow_session=valid-token'];
}

describe('Organization Admin APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.userOrganization.findMany.mockReset();
    prismaMock.userOrganization.findFirst.mockReset();
    prismaMock.userOrganization.findUnique.mockReset();
    prismaMock.userOrganization.create.mockReset();
    prismaMock.userOrganization.update.mockReset();
    prismaMock.userOrganization.count.mockReset();
    prismaMock.userOrganization.groupBy.mockReset();
    prismaMock.organization.findUnique.mockReset();
    prismaMock.organization.count.mockReset();
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.create.mockReset();
    prismaMock.user.update.mockReset();
    prismaMock.user.count.mockReset();
  });

  describe('access control', () => {
    it('rejects unauthenticated access', async () => {
      const res = await request(app).get('/api/v1/org/dashboard');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('NOT_AUTHENTICATED');
    });

    it('allows an organization admin to view the dashboard for their tenant', async () => {
      await authenticateAs('ORG_ADMIN', { userId: 'org-a-admin', organizationId: 'org-a' });
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord());
      prismaMock.userOrganization.count
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1);

      const res = await request(app)
        .get('/api/v1/org/dashboard')
        .set('Cookie', cookie())
        .set('X-Organization-Id', 'org-b');

      expect(res.status).toBe(200);
      expect(res.body.data.organization.id).toBe('org-a');
      expect(res.body.data.users).toEqual({
        total: 6,
        instructors: 2,
        students: 3,
        organizationAdmins: 1,
      });
      expect(prismaMock.organization.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'org-a' },
      }));
    });

    it('keeps platform admin APIs separate from organization admin APIs', async () => {
      await authenticateAs('PLATFORM_ADMIN', { organizationId: 'platform-org' });

      const orgAdminRes = await request(app)
        .get('/api/v1/org/dashboard')
        .set('Cookie', cookie());
      expect(orgAdminRes.status).toBe(403);
      expect(orgAdminRes.body.error).toBe('ORG_ADMIN_REQUIRED');

      prismaMock.organization.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);
      prismaMock.user.count.mockResolvedValue(1);
      prismaMock.userOrganization.count.mockResolvedValue(0);

      const platformRes = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Cookie', cookie());
      expect(platformRes.status).toBe(200);
    });

    it('lets a platform admin enter a specific organization via X-Organization-Id', async () => {
      await authenticateAs('PLATFORM_ADMIN', { organizationId: 'platform-org' });
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord({ id: 'org-b' }));
      prismaMock.userOrganization.count
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1);

      const res = await request(app)
        .get('/api/v1/org/dashboard')
        .set('Cookie', cookie())
        .set('X-Organization-Id', 'org-b');

      expect(res.status).toBe(200);
      expect(res.body.data.organization.id).toBe('org-b');
      expect(res.body.data.users).toEqual({
        total: 6,
        instructors: 2,
        students: 3,
        organizationAdmins: 1,
      });
      expect(prismaMock.organization.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'org-b' },
      }));
    });

    it.each(['INSTRUCTOR', 'STUDENT'] as const)('rejects %s access to organization admin APIs', async (role) => {
      await authenticateAs(role, { organizationId: 'org-a' });

      const res = await request(app)
        .get('/api/v1/org/users')
        .set('Cookie', cookie());

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ORG_ADMIN_REQUIRED');
    });

    it('rejects organization admin access to platform admin APIs', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });

      const res = await request(app)
        .get('/api/v1/organizations')
        .set('Cookie', cookie());

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('PLATFORM_ADMIN_REQUIRED');
    });
  });

  describe('organization information and users', () => {
    it('returns the authenticated organization, ignoring a client-supplied organizationId', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord());

      const res = await request(app)
        .get('/api/v1/org/organization')
        .set('Cookie', cookie())
        .send({ organizationId: 'org-b' })
        .set('X-Organization-Id', 'org-b');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('org-a');
      expect(prismaMock.organization.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'org-a' },
      }));
    });

    it('lists users in the organization admin tenant only', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });
      prismaMock.userOrganization.findMany.mockResolvedValue([membershipRecord()]);
      prismaMock.userOrganization.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/org/users')
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.data[0].email).toBe('ira@example.com');
      expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 1 });
      expect(prismaMock.userOrganization.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { organizationId: 'org-a' },
      }));
    });

    it('creates an instructor in the organization admin tenant', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord());
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        id: 'instructor-2',
        name: 'New Instructor',
        email: 'new.instructor@example.com',
        emailVerified: false,
        passwordHash: 'hashed-password',
        createdAt: now,
        updatedAt: now,
      });
      prismaMock.user.update.mockResolvedValue({ id: 'instructor-2', emailVerified: true });
      prismaMock.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'instructor-2',
          name: 'New Instructor',
          email: 'new.instructor@example.com',
          emailVerified: true,
          passwordHash: 'hashed-password',
          createdAt: now,
          updatedAt: now,
        });
      prismaMock.userOrganization.findUnique.mockResolvedValue(null);
      prismaMock.userOrganization.create.mockResolvedValue(membershipRecord({
        userId: 'instructor-2',
        role: 'INSTRUCTOR',
        user: {
          id: 'instructor-2',
          name: 'New Instructor',
          email: 'new.instructor@example.com',
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      }));

      const res = await request(app)
        .post('/api/v1/org/instructors')
        .set('Cookie', cookie())
        .send({
          name: 'New Instructor',
          email: 'new.instructor@example.com',
          password: 'securepass123',
          organizationId: 'org-b',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.role).toBe('INSTRUCTOR');
      expect(prismaMock.userOrganization.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-a',
          role: 'INSTRUCTOR',
        }),
      }));
    });

    it('creates a student in the organization admin tenant', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord());
      prismaMock.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'student-2',
          name: 'New Student',
          email: 'new.student@example.com',
          emailVerified: true,
          passwordHash: 'hashed-password',
          createdAt: now,
          updatedAt: now,
        });
      prismaMock.user.create.mockResolvedValue({
        id: 'student-2',
        name: 'New Student',
        email: 'new.student@example.com',
        emailVerified: false,
        passwordHash: 'hashed-password',
        createdAt: now,
        updatedAt: now,
      });
      prismaMock.user.update.mockResolvedValue({ id: 'student-2', emailVerified: true });
      prismaMock.userOrganization.findUnique.mockResolvedValue(null);
      prismaMock.userOrganization.create.mockResolvedValue(membershipRecord({
        userId: 'student-2',
        role: 'STUDENT',
        user: {
          id: 'student-2',
          name: 'New Student',
          email: 'new.student@example.com',
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      }));

      const res = await request(app)
        .post('/api/v1/org/students')
        .set('Cookie', cookie())
        .send({
          name: 'New Student',
          email: 'new.student@example.com',
          password: 'securepass123',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.role).toBe('STUDENT');
    });

    it('rejects a duplicate user already in the organization', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord());
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'instructor-1',
        name: 'Ira Instructor',
        email: 'ira@example.com',
        emailVerified: true,
        passwordHash: 'hash',
        createdAt: now,
        updatedAt: now,
      });
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

      const res = await request(app)
        .post('/api/v1/org/instructors')
        .set('Cookie', cookie())
        .send({
          email: 'ira@example.com',
          password: 'securepass123',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('USER_ALREADY_IN_ORGANIZATION');
    });

    it('updates an instructor name within the same organization', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });
      prismaMock.userOrganization.findUnique
        .mockResolvedValueOnce(membershipRecord())
        .mockResolvedValueOnce(membershipRecord({
          user: {
            id: 'instructor-1',
            name: 'Ira Updated',
            email: 'ira@example.com',
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          },
        }));
      prismaMock.user.update.mockResolvedValue({ id: 'instructor-1', name: 'Ira Updated' });

      const res = await request(app)
        .patch('/api/v1/org/users/instructor-1')
        .set('Cookie', cookie())
        .send({ name: 'Ira Updated', organizationId: 'org-b', role: 'PLATFORM_ADMIN' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ROLE_NOT_ALLOWED');
    });

    it('updates instructor name without allowing privilege escalation', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });
      prismaMock.userOrganization.findUnique
        .mockResolvedValueOnce(membershipRecord())
        .mockResolvedValueOnce(membershipRecord({
          user: {
            id: 'instructor-1',
            name: 'Ira Updated',
            email: 'ira@example.com',
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          },
        }));
      prismaMock.user.update.mockResolvedValue({ id: 'instructor-1', name: 'Ira Updated' });

      const res = await request(app)
        .patch('/api/v1/org/users/instructor-1')
        .set('Cookie', cookie())
        .send({ name: 'Ira Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Ira Updated');
      expect(prismaMock.user.update).toHaveBeenCalled();
    });

    it('returns organization growth analytics scoped to the authenticated organization', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord());
      prismaMock.userOrganization.groupBy.mockResolvedValue([
        { role: 'ORG_ADMIN', _count: { _all: 1 } },
        { role: 'INSTRUCTOR', _count: { _all: 2 } },
        { role: 'STUDENT', _count: { _all: 5 } },
      ]);
      prismaMock.userOrganization.findMany.mockResolvedValue([
        { createdAt: new Date('2026-01-15'), role: 'STUDENT' },
        { createdAt: new Date('2026-02-10'), role: 'INSTRUCTOR' },
        { createdAt: new Date('2026-03-20'), role: 'STUDENT' },
        { createdAt: new Date('2026-04-05'), role: 'ORG_ADMIN' },
        { createdAt: new Date('2026-05-12'), role: 'STUDENT' },
        { createdAt: new Date('2026-06-18'), role: 'STUDENT' },
      ]);

      const res = await request(app)
        .get('/api/v1/org/analytics')
        .set('Cookie', cookie())
        .set('X-Organization-Id', 'org-b');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.organization.id).toBe('org-a');
      expect(res.body.data.growth).toBeDefined();
      expect(Array.isArray(res.body.data.growth)).toBe(true);
      expect(res.body.data.growth.length).toBeGreaterThan(0);
      expect(res.body.data.growth[0]).toHaveProperty('month');
      expect(res.body.data.growth[0]).toHaveProperty('members');
      expect(prismaMock.organization.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'org-a' },
      }));
      expect(prismaMock.userOrganization.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { organizationId: 'org-a' },
        select: { createdAt: true, role: true },
        orderBy: { createdAt: 'asc' },
      }));
    });
  });

  describe('IDOR, escalation, and invalid input', () => {
    it('does not return a user that belongs to another organization', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });
      prismaMock.userOrganization.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/org/users/org-b-user')
        .set('Cookie', cookie())
        .set('X-Organization-Id', 'org-b');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('USER_NOT_FOUND');
      expect(prismaMock.userOrganization.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          userId_organizationId: {
            userId: 'org-b-user',
            organizationId: 'org-a',
          },
        },
      }));
    });

    it('rejects creating a platform admin through instructor creation', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });

      const res = await request(app)
        .post('/api/v1/org/instructors')
        .set('Cookie', cookie())
        .send({
          name: 'Attacker',
          email: 'attacker@example.com',
          password: 'securepass123',
          role: 'PLATFORM_ADMIN',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ROLE_NOT_ALLOWED');
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('rejects promoting a student to organization admin', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({
        userId: 'student-1',
        role: 'STUDENT',
        user: {
          id: 'student-1',
          name: 'Sam',
          email: 'sam@example.com',
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      }));

      const res = await request(app)
        .patch('/api/v1/org/users/student-1')
        .set('Cookie', cookie())
        .send({ role: 'ORG_ADMIN' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ROLE_NOT_ALLOWED');
    });

    it('rejects invalid email when creating a student', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });

      const res = await request(app)
        .post('/api/v1/org/students')
        .set('Cookie', cookie())
        .send({
          name: 'Bad Email',
          email: 'not-an-email',
          password: 'securepass123',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_EMAIL');
    });

    it('rejects missing fields when creating an instructor', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });

      const res = await request(app)
        .post('/api/v1/org/instructors')
        .set('Cookie', cookie())
        .send({ name: 'No Email' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_FIELDS');
    });

    it('rejects a weak password when creating a new student', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });
      prismaMock.organization.findUnique.mockResolvedValue(orgRecord());
      prismaMock.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/org/students')
        .set('Cookie', cookie())
        .send({
          name: 'Weak',
          email: 'weak@example.com',
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('PASSWORD_TOO_SHORT');
    });
  });

  describe('instructor creation authorization', () => {
    function createPayload(overrides: Record<string, unknown> = {}) {
      return {
        name: 'New Instructor',
        email: 'new.instructor@example.com',
        password: 'securepass123',
        ...overrides,
      };
    }

    it('rejects unauthenticated instructor creation', async () => {
      const res = await request(app)
        .post('/api/v1/org/instructors')
        .send(createPayload());

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('NOT_AUTHENTICATED');
      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(prismaMock.userOrganization.create).not.toHaveBeenCalled();
    });

    it.each(['PLATFORM_ADMIN', 'INSTRUCTOR', 'STUDENT'] as const)(
      'rejects %s from creating an instructor',
      async (role) => {
        await authenticateAs(role, { organizationId: 'org-a' });

        const res = await request(app)
          .post('/api/v1/org/instructors')
          .set('Cookie', cookie())
          .send(createPayload());

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('ORG_ADMIN_REQUIRED');
        expect(prismaMock.user.create).not.toHaveBeenCalled();
        expect(prismaMock.userOrganization.create).not.toHaveBeenCalled();
      }
    );

    it('rejects requesting the ORG_ADMIN role through instructor creation', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });

      const res = await request(app)
        .post('/api/v1/org/instructors')
        .set('Cookie', cookie())
        .send(createPayload({ role: 'ORG_ADMIN' }));

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ROLE_NOT_ALLOWED');
      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(prismaMock.userOrganization.create).not.toHaveBeenCalled();
    });

    it('rejects requesting the PLATFORM_ADMIN role through instructor creation', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });

      const res = await request(app)
        .post('/api/v1/org/instructors')
        .set('Cookie', cookie())
        .send(createPayload({ role: 'PLATFORM_ADMIN' }));

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ROLE_NOT_ALLOWED');
      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(prismaMock.userOrganization.create).not.toHaveBeenCalled();
    });

    it('cannot escalate an existing instructor to ORG_ADMIN via update', async () => {
      await authenticateAs('ORG_ADMIN', { organizationId: 'org-a' });
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

      const res = await request(app)
        .patch('/api/v1/org/users/instructor-1')
        .set('Cookie', cookie())
        .send({ role: 'ORG_ADMIN' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ROLE_NOT_ALLOWED');
      expect(prismaMock.userOrganization.update).not.toHaveBeenCalled();
    });
  });
});
