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
  notification: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
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

const now = new Date('2026-08-28T16:00:00.000Z');

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

function notificationRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notif-1',
    type: 'ENROLLMENT_CONFIRMATION',
    title: 'Enrolled in Course',
    body: 'You have been enrolled in React Fundamentals.',
    data: { courseId: 'course-1' },
    readAt: null,
    userId: 'user-1',
    organizationId: 'org-a',
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
  prismaMock.notification.create.mockReset();
  prismaMock.notification.findMany.mockReset();
  prismaMock.notification.findFirst.mockReset();
  prismaMock.notification.updateMany.mockReset();
  prismaMock.notification.count.mockReset();
  vi.mocked(authService.getSessionFromToken).mockReset();
  vi.mocked(authService.getUserById).mockReset();
}

const LIST_PATH = '/api/v1/organizations/org-a/student/notifications';

describe('GET /api/v1/organizations/:organizationId/student/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get(LIST_PATH);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('rejects students with unverified email with 403', async () => {
    await authenticateAs('STUDENT', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

    const res = await request(app).get(LIST_PATH).set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
  });

  it('rejects non-student roles with 403', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ role: 'INSTRUCTOR' }),
    );

    const res = await request(app).get(LIST_PATH).set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('returns 403 for cross-tenant organization access', async () => {
    await authenticateAs('STUDENT', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-b/student/notifications')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
  });

  it('lists notifications scoped to the student and tenant with unread count', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.notification.findMany.mockResolvedValue([
      notificationRecord(),
      notificationRecord({
        id: 'notif-2',
        type: 'COURSE_COMPLETION',
        title: 'Course completed',
        readAt: now,
      }),
    ]);
    prismaMock.notification.count.mockResolvedValue(1);

    const res = await request(app).get(LIST_PATH).set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notifications).toHaveLength(2);
    expect(res.body.data.unreadCount).toBe(1);

    const findManyArgs = prismaMock.notification.findMany.mock.calls[0][0];
    expect(findManyArgs.where.userId).toBe('user-1');
    expect(findManyArgs.where.organizationId).toBe('org-a');
    expect(prismaMock.notification.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', organizationId: 'org-a', readAt: null },
      }),
    );
  });

  it('filters to unread notifications when unreadOnly is set', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.notification.findMany.mockResolvedValue([notificationRecord()]);
    prismaMock.notification.count.mockResolvedValue(1);

    const res = await request(app)
      .get(`${LIST_PATH}?unreadOnly=true`)
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    const args = prismaMock.notification.findMany.mock.calls[0][0];
    expect(args.where.readAt).toBeNull();
  });
});

describe('GET /api/v1/organizations/:organizationId/student/notifications/unread-count', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('returns the unread count for the student', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.notification.count.mockResolvedValue(3);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/notifications/unread-count')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBe(3);
  });
});

describe('POST /api/v1/organizations/:organizationId/student/notifications/:notificationId/read', () => {
  const READ_PATH =
    '/api/v1/organizations/org-a/student/notifications/notif-1/read';

  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).post(READ_PATH);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('marks a notification as read for the owning student in the tenant', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.notification.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.notification.findFirst.mockResolvedValue(notificationRecord({ readAt: now }));

    const res = await request(app).post(READ_PATH).set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.data.read).toBe(true);

    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notif-1', userId: 'user-1', organizationId: 'org-a', readAt: null },
        data: { readAt: expect.any(Date) },
      }),
    );
  });

  it('returns 404 when the notification does not belong to the student', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.notification.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(app).post(READ_PATH).set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOTIFICATION_NOT_FOUND');
  });
});

describe('POST /api/v1/organizations/:organizationId/student/notifications/read-all', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('marks all unread notifications as read for the student in the tenant', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.notification.updateMany.mockResolvedValue({ count: 2 });

    const res = await request(app)
      .post('/api/v1/organizations/org-a/student/notifications/read-all')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', organizationId: 'org-a', readAt: null },
        data: { readAt: expect.any(Date) },
      }),
    );
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).post(
      '/api/v1/organizations/org-a/student/notifications/read-all',
    );
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });
});
