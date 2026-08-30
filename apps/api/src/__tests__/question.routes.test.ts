import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

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
  quiz: {
    findFirst: vi.fn(),
  },
  question: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  quizOption: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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

const now = new Date('2026-08-27T10:00:00.000Z');

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
    title: 'Test Course',
    slug: 'test-course',
    status: 'DRAFT',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function moduleRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'module-1',
    courseId: 'course-1',
    title: 'Test Module',
    order: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function quizRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'quiz-1',
    moduleId: 'module-1',
    title: 'Test Quiz',
    description: 'A test quiz',
    timeLimitMinutes: 30,
    passingPercentage: 70,
    maxAttempts: 3,
    order: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function questionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'question-1',
    quizId: 'quiz-1',
    questionText: 'What is 2 + 2?',
    marks: 1,
    order: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function questionDetailRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...questionRecord(),
    options: [],
    ...overrides,
  };
}

function optionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'option-1',
    questionId: 'question-1',
    text: '4',
    isCorrect: true,
    order: 0,
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

  prismaMock.userOrganization.findUnique.mockResolvedValue(
    membershipRecord({ role, organizationId, userId }),
  );
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
  prismaMock.quiz.findFirst.mockReset();
  prismaMock.question.create.mockReset();
  prismaMock.question.findMany.mockReset();
  prismaMock.question.findFirst.mockReset();
  prismaMock.question.findUnique.mockReset();
  prismaMock.question.update.mockReset();
  prismaMock.question.delete.mockReset();
  prismaMock.quizOption.create.mockReset();
  prismaMock.quizOption.findMany.mockReset();
  prismaMock.quizOption.findFirst.mockReset();
  prismaMock.quizOption.update.mockReset();
  prismaMock.quizOption.delete.mockReset();
  vi.mocked(authService.getSessionFromToken).mockReset();
  vi.mocked(authService.getUserById).mockReset();
}

async function setValidAuth(role: 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'INSTRUCTOR' | 'STUDENT' = 'INSTRUCTOR') {
  await authenticateAs(role);
  prismaMock.userOrganization.findUnique.mockResolvedValue(
    membershipRecord({ role }),
  );
  prismaMock.course.findFirst.mockResolvedValue(courseRecord());
  prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
  prismaMock.quiz.findFirst.mockResolvedValue(quizRecord());
}

const QUESTIONS_BASE = '/api/v1/organizations/org-a/courses/course-1/modules/module-1/quizzes/quiz-1/questions';
const OPTIONS_BASE = `${QUESTIONS_BASE}/question-1/options`;

beforeEach(() => {
  resetMocks();
});

describe('Question routes', () => {
  describe('POST /questions', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).post(QUESTIONS_BASE).send({});
      expect(res.status).toBe(401);
    });

    it('returns 403 when email is not verified', async () => {
      await authenticateAs('INSTRUCTOR', { emailVerified: false });
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
      prismaMock.course.findFirst.mockResolvedValue(courseRecord());
      prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
      prismaMock.quiz.findFirst.mockResolvedValue(quizRecord());

      const res = await request(app)
        .post(QUESTIONS_BASE)
        .set('Cookie', cookie())
        .send({ questionText: 'Q1', order: 0 });
      expect(res.status).toBe(403);
    });

    it('returns 403 for student role', async () => {
      await authenticateAs('STUDENT');
      prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord({ role: 'STUDENT' }));
      prismaMock.course.findFirst.mockResolvedValue(courseRecord());
      prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
      prismaMock.quiz.findFirst.mockResolvedValue(quizRecord());

      const res = await request(app)
        .post(QUESTIONS_BASE)
        .set('Cookie', cookie())
        .send({ questionText: 'Q1', order: 0 });
      expect(res.status).toBe(403);
    });

    it('creates question as instructor', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.create.mockResolvedValue(questionRecord());

      const res = await request(app)
        .post(QUESTIONS_BASE)
        .set('Cookie', cookie())
        .send({ questionText: 'What is 2 + 2?', order: 0, marks: 1 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('question-1');
    });

    it('creates question as org admin', async () => {
      await setValidAuth('ORG_ADMIN');
      prismaMock.question.create.mockResolvedValue(questionRecord());

      const res = await request(app)
        .post(QUESTIONS_BASE)
        .set('Cookie', cookie())
        .send({ questionText: 'What is 2 + 2?', order: 0 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when quiz not found', async () => {
      await setValidAuth();
      prismaMock.quiz.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post(QUESTIONS_BASE)
        .set('Cookie', cookie())
        .send({ questionText: 'Q1', order: 0 });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('QUIZ_NOT_FOUND');
    });

    it('returns 400 when questionText is missing', async () => {
      await setValidAuth();

      const res = await request(app)
        .post(QUESTIONS_BASE)
        .set('Cookie', cookie())
        .send({ order: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_FIELDS');
    });

    it('returns 400 when order is missing', async () => {
      await setValidAuth();

      const res = await request(app)
        .post(QUESTIONS_BASE)
        .set('Cookie', cookie())
        .send({ questionText: 'Q1' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_FIELDS');
    });

    it('returns 400 when order is negative', async () => {
      await setValidAuth();

      const res = await request(app)
        .post(QUESTIONS_BASE)
        .set('Cookie', cookie())
        .send({ questionText: 'Q1', order: -1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_ORDER');
    });

    it('returns 400 when marks is less than 1', async () => {
      await setValidAuth();

      const res = await request(app)
        .post(QUESTIONS_BASE)
        .set('Cookie', cookie())
        .send({ questionText: 'Q1', order: 0, marks: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_VALUE');
    });

    it('returns 409 when order is duplicate', async () => {
      await setValidAuth();
      prismaMock.question.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '4.0.0', meta: {} }),
      );

      const res = await request(app)
        .post(QUESTIONS_BASE)
        .set('Cookie', cookie())
        .send({ questionText: 'Q1', order: 0 });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('QUESTION_ORDER_TAKEN');
    });
  });

  describe('GET /questions', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).get(QUESTIONS_BASE);
      expect(res.status).toBe(401);
    });

    it('lists questions as instructor', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findMany.mockResolvedValue([questionRecord()]);

      const res = await request(app).get(QUESTIONS_BASE).set('Cookie', cookie());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns 404 when quiz not found', async () => {
      await setValidAuth();
      prismaMock.quiz.findFirst.mockResolvedValue(null);

      const res = await request(app).get(QUESTIONS_BASE).set('Cookie', cookie());
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('QUIZ_NOT_FOUND');
    });

    it('returns empty array when no questions exist', async () => {
      await setValidAuth();
      prismaMock.question.findMany.mockResolvedValue([]);

      const res = await request(app).get(QUESTIONS_BASE).set('Cookie', cookie());
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /questions/:questionId', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).get(`${QUESTIONS_BASE}/question-1`);
      expect(res.status).toBe(401);
    });

    it('gets question with options as instructor', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());

      const res = await request(app).get(`${QUESTIONS_BASE}/question-1`).set('Cookie', cookie());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('question-1');
      expect(res.body.data.options).toEqual([]);
    });

    it('returns 404 when question not found', async () => {
      await setValidAuth();
      prismaMock.question.findFirst.mockResolvedValue(null);

      const res = await request(app).get(`${QUESTIONS_BASE}/question-1`).set('Cookie', cookie());
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('QUESTION_NOT_FOUND');
    });
  });

  describe('PATCH /questions/:questionId', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).patch(`${QUESTIONS_BASE}/question-1`).send({ questionText: 'Updated' });
      expect(res.status).toBe(401);
    });

    it('updates question as instructor', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      prismaMock.question.update.mockResolvedValue(questionRecord({ questionText: 'Updated Q' }));

      const res = await request(app)
        .patch(`${QUESTIONS_BASE}/question-1`)
        .set('Cookie', cookie())
        .send({ questionText: 'Updated Q' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when question not found', async () => {
      await setValidAuth();
      prismaMock.question.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .patch(`${QUESTIONS_BASE}/question-1`)
        .set('Cookie', cookie())
        .send({ questionText: 'Updated' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('QUESTION_NOT_FOUND');
    });

    it('returns 400 when body is empty', async () => {
      await setValidAuth();
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());

      const res = await request(app)
        .patch(`${QUESTIONS_BASE}/question-1`)
        .set('Cookie', cookie())
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_FIELDS');
    });

    it('returns 409 when order is duplicate', async () => {
      await setValidAuth();
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      prismaMock.question.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '4.0.0', meta: {} }),
      );

      const res = await request(app)
        .patch(`${QUESTIONS_BASE}/question-1`)
        .set('Cookie', cookie())
        .send({ order: 1 });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('QUESTION_ORDER_TAKEN');
    });
  });

  describe('DELETE /questions/:questionId', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).delete(`${QUESTIONS_BASE}/question-1`);
      expect(res.status).toBe(401);
    });

    it('deletes question as instructor', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      prismaMock.question.delete.mockResolvedValue(questionRecord());

      const res = await request(app).delete(`${QUESTIONS_BASE}/question-1`).set('Cookie', cookie());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when question not found', async () => {
      await setValidAuth();
      prismaMock.question.findFirst.mockResolvedValue(null);

      const res = await request(app).delete(`${QUESTIONS_BASE}/question-1`).set('Cookie', cookie());
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('QUESTION_NOT_FOUND');
    });
  });

  describe('Cross-tenant isolation', () => {
    it('prevents cross-tenant question creation', async () => {
      await authenticateAs('INSTRUCTOR', { organizationId: 'org-b' });
      prismaMock.userOrganization.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post(QUESTIONS_BASE)
        .set('Cookie', cookie())
        .send({ questionText: 'Q1', order: 0 });
      expect(res.status).toBe(403);
    });

    it('prevents cross-tenant question listing', async () => {
      await authenticateAs('INSTRUCTOR', { organizationId: 'org-b' });
      prismaMock.userOrganization.findUnique.mockResolvedValue(null);

      const res = await request(app).get(QUESTIONS_BASE).set('Cookie', cookie());
      expect(res.status).toBe(403);
    });
  });
});

describe('QuizOption routes', () => {
  describe('POST /questions/:questionId/options', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).post(OPTIONS_BASE).send({});
      expect(res.status).toBe(401);
    });

    it('creates option as instructor', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      prismaMock.quizOption.create.mockResolvedValue(optionRecord());

      const res = await request(app)
        .post(OPTIONS_BASE)
        .set('Cookie', cookie())
        .send({ text: '4', order: 0, isCorrect: true });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('option-1');
    });

    it('creates option as org admin', async () => {
      await setValidAuth('ORG_ADMIN');
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      prismaMock.quizOption.create.mockResolvedValue(optionRecord());

      const res = await request(app)
        .post(OPTIONS_BASE)
        .set('Cookie', cookie())
        .send({ text: '4', order: 0, isCorrect: true });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when question not found', async () => {
      await setValidAuth();
      prismaMock.question.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post(OPTIONS_BASE)
        .set('Cookie', cookie())
        .send({ text: '4', order: 0 });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('QUESTION_NOT_FOUND');
    });

    it('returns 400 when text is missing', async () => {
      await setValidAuth();
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());

      const res = await request(app)
        .post(OPTIONS_BASE)
        .set('Cookie', cookie())
        .send({ order: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_FIELDS');
    });

    it('returns 400 when order is missing', async () => {
      await setValidAuth();
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());

      const res = await request(app)
        .post(OPTIONS_BASE)
        .set('Cookie', cookie())
        .send({ text: '4' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_FIELDS');
    });

    it('returns 400 when order is negative', async () => {
      await setValidAuth();
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());

      const res = await request(app)
        .post(OPTIONS_BASE)
        .set('Cookie', cookie())
        .send({ text: '4', order: -1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_ORDER');
    });

    it('returns 400 when isCorrect is not boolean', async () => {
      await setValidAuth();
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());

      const res = await request(app)
        .post(OPTIONS_BASE)
        .set('Cookie', cookie())
        .send({ text: '4', order: 0, isCorrect: 'yes' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_VALUE');
    });
  });

  describe('GET /questions/:questionId/options', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).get(OPTIONS_BASE);
      expect(res.status).toBe(401);
    });

    it('lists options as instructor', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      prismaMock.quizOption.findMany.mockResolvedValue([optionRecord()]);

      const res = await request(app).get(OPTIONS_BASE).set('Cookie', cookie());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns 404 when question not found', async () => {
      await setValidAuth();
      prismaMock.question.findFirst.mockResolvedValue(null);

      const res = await request(app).get(OPTIONS_BASE).set('Cookie', cookie());
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('QUESTION_NOT_FOUND');
    });
  });

  describe('PATCH /questions/:questionId/options/:optionId', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).patch(`${OPTIONS_BASE}/option-1`).send({ text: 'Updated' });
      expect(res.status).toBe(401);
    });

    it('updates option as instructor', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      prismaMock.quizOption.findFirst.mockResolvedValue(optionRecord());
      prismaMock.quizOption.update.mockResolvedValue(optionRecord({ text: 'Updated' }));

      const res = await request(app)
        .patch(`${OPTIONS_BASE}/option-1`)
        .set('Cookie', cookie())
        .send({ text: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when option not found', async () => {
      await setValidAuth();
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      prismaMock.quizOption.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .patch(`${OPTIONS_BASE}/option-1`)
        .set('Cookie', cookie())
        .send({ text: 'Updated' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('OPTION_NOT_FOUND');
    });

    it('returns 400 when body is empty', async () => {
      await setValidAuth();
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      prismaMock.quizOption.findFirst.mockResolvedValue(optionRecord());

      const res = await request(app)
        .patch(`${OPTIONS_BASE}/option-1`)
        .set('Cookie', cookie())
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_FIELDS');
    });
  });

  describe('DELETE /questions/:questionId/options/:optionId', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).delete(`${OPTIONS_BASE}/option-1`);
      expect(res.status).toBe(401);
    });

    it('deletes option as instructor', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      prismaMock.quizOption.findFirst.mockResolvedValue(optionRecord());
      prismaMock.quizOption.delete.mockResolvedValue(optionRecord());

      const res = await request(app).delete(`${OPTIONS_BASE}/option-1`).set('Cookie', cookie());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when option not found', async () => {
      await setValidAuth();
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      prismaMock.quizOption.findFirst.mockResolvedValue(null);

      const res = await request(app).delete(`${OPTIONS_BASE}/option-1`).set('Cookie', cookie());
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('OPTION_NOT_FOUND');
    });
  });

  describe('Cross-tenant isolation', () => {
    it('prevents cross-tenant option creation', async () => {
      await authenticateAs('INSTRUCTOR', { organizationId: 'org-b' });
      prismaMock.userOrganization.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post(OPTIONS_BASE)
        .set('Cookie', cookie())
        .send({ text: '4', order: 0 });
      expect(res.status).toBe(403);
    });

    it('prevents cross-tenant option listing', async () => {
      await authenticateAs('INSTRUCTOR', { organizationId: 'org-b' });
      prismaMock.userOrganization.findUnique.mockResolvedValue(null);

      const res = await request(app).get(OPTIONS_BASE).set('Cookie', cookie());
      expect(res.status).toBe(403);
    });
  });
});

describe('Parent ownership isolation', () => {
  it('returns 404 when accessing question from different quiz', async () => {
    await setValidAuth();
    prismaMock.question.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get(`${QUESTIONS_BASE}/question-1`)
      .set('Cookie', cookie());
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('QUESTION_NOT_FOUND');
  });

  it('returns 404 when accessing option from different question', async () => {
    await setValidAuth();
    prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
    prismaMock.quizOption.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .patch(`${OPTIONS_BASE}/option-1`)
      .set('Cookie', cookie())
      .send({ text: 'Updated' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('OPTION_NOT_FOUND');
  });
});
