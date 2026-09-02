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
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  quizOption: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
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
    { role, organizationId, userId, organization: { slug: organizationId, id: organizationId } },
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
  prismaMock.question.updateMany.mockReset();
  prismaMock.question.delete.mockReset();
  prismaMock.question.deleteMany.mockReset();
  prismaMock.quizOption.create.mockReset();
  prismaMock.quizOption.findMany.mockReset();
  prismaMock.quizOption.findFirst.mockReset();
  prismaMock.quizOption.update.mockReset();
  prismaMock.quizOption.updateMany.mockReset();
  prismaMock.quizOption.delete.mockReset();
  prismaMock.quizOption.deleteMany.mockReset();
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
      // updateQuestion now uses updateMany bound to (questionId, quizId) then findFirst (fix).
      prismaMock.question.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.question.findFirst
        .mockResolvedValueOnce(questionDetailRecord())                            // pre-check getById
        .mockResolvedValueOnce(questionDetailRecord({ questionText: 'Updated Q' })); // post-update fetch

      const res = await request(app)
        .patch(`${QUESTIONS_BASE}/question-1`)
        .set('Cookie', cookie())
        .send({ questionText: 'Updated Q' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Verify DB mutation is bound to BOTH questionId AND quizId.
      expect(prismaMock.question.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'question-1', quizId: 'quiz-1' }),
        }),
      );
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
      // updateQuestion now uses updateMany bound to (questionId, quizId).
      prismaMock.question.updateMany.mockRejectedValue(
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
      // deleteQuestion now uses deleteMany bound to (questionId, quizId).
      prismaMock.question.deleteMany.mockResolvedValue({ count: 1 });

      const res = await request(app).delete(`${QUESTIONS_BASE}/question-1`).set('Cookie', cookie());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prismaMock.question.deleteMany).toHaveBeenCalledWith({
        where: { id: 'question-1', quizId: 'quiz-1' },
      });
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
      // updateOption now uses updateMany bound to (optionId, questionId) then findFirst.
      prismaMock.quizOption.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.quizOption.findFirst
        .mockResolvedValueOnce(optionRecord())                  // pre-check getOptionById
        .mockResolvedValueOnce(optionRecord({ text: 'Updated' })); // post-update fetch

      const res = await request(app)
        .patch(`${OPTIONS_BASE}/option-1`)
        .set('Cookie', cookie())
        .send({ text: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prismaMock.quizOption.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'option-1', questionId: 'question-1' }),
        }),
      );
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
      // deleteOption now uses deleteMany bound to (optionId, questionId).
      prismaMock.quizOption.deleteMany.mockResolvedValue({ count: 1 });

      const res = await request(app).delete(`${OPTIONS_BASE}/option-1`).set('Cookie', cookie());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prismaMock.quizOption.deleteMany).toHaveBeenCalledWith({
        where: { id: 'option-1', questionId: 'question-1' },
      });
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

// ─── Security Regression Tests: Question & Option Ownership ───────────────────
//
// These tests verify that the final Prisma mutation is bound to the parent ID
// at the persistence layer — not merely guarded by service-level checks.
//
// A. Question from Quiz B cannot be updated via Quiz A context.
// B. Question from Quiz B cannot be deleted via Quiz A context.
// C. Option from Question B cannot be updated via Question A context.
// D. Option from Question B cannot be deleted via Question A context.
// E. Correct parent IDs allow legitimate update/delete.
// F. Org → course → module → quiz authorization chain remains intact.

describe('Question & Option ownership security regression (NEW-H-01 fix)', () => {
  beforeEach(() => {
    resetMocks();
  });

  // ── A: Question from Quiz B cannot be updated via Quiz A ──────────────────

  describe('A. Question from Quiz B cannot be updated through Quiz A context', () => {
    it('returns 404 when questionId does not belong to the requested quizId', async () => {
      await setValidAuth('INSTRUCTOR');
      // getById(quizId='quiz-1', questionId='question-from-quiz-b') returns null
      prismaMock.question.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .patch(`${QUESTIONS_BASE}/question-from-quiz-b`)
        .set('Cookie', cookie())
        .send({ questionText: 'Injected update' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('QUESTION_NOT_FOUND');
      // The DB updateMany must never be reached.
      expect(prismaMock.question.updateMany).not.toHaveBeenCalled();
    });

    it('updateMany WHERE clause is bound to BOTH questionId AND quizId', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findFirst
        .mockResolvedValueOnce(questionDetailRecord())           // pre-check passes
        .mockResolvedValueOnce(questionDetailRecord({ questionText: 'Updated' })); // post-update fetch
      prismaMock.question.updateMany.mockResolvedValue({ count: 1 });

      await request(app)
        .patch(`${QUESTIONS_BASE}/question-1`)
        .set('Cookie', cookie())
        .send({ questionText: 'Updated' });

      expect(prismaMock.question.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'question-1', quizId: 'quiz-1' }),
        }),
      );
    });
  });

  // ── B: Question from Quiz B cannot be deleted via Quiz A ──────────────────

  describe('B. Question from Quiz B cannot be deleted through Quiz A context', () => {
    it('returns 404 when questionId does not belong to the requested quizId', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .delete(`${QUESTIONS_BASE}/question-from-quiz-b`)
        .set('Cookie', cookie());

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('QUESTION_NOT_FOUND');
      expect(prismaMock.question.deleteMany).not.toHaveBeenCalled();
    });

    it('deleteMany WHERE clause is bound to BOTH questionId AND quizId', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      prismaMock.question.deleteMany.mockResolvedValue({ count: 1 });

      await request(app)
        .delete(`${QUESTIONS_BASE}/question-1`)
        .set('Cookie', cookie());

      expect(prismaMock.question.deleteMany).toHaveBeenCalledWith({
        where: { id: 'question-1', quizId: 'quiz-1' },
      });
    });
  });

  // ── C: Option from Question B cannot be updated via Question A ────────────

  describe('C. Option from Question B cannot be updated through Question A context', () => {
    it('returns 404 when optionId does not belong to the requested questionId', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      // getOptionById(questionId='question-1', optionId='option-from-question-b') → null
      prismaMock.quizOption.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .patch(`${OPTIONS_BASE}/option-from-question-b`)
        .set('Cookie', cookie())
        .send({ text: 'Injected update' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('OPTION_NOT_FOUND');
      expect(prismaMock.quizOption.updateMany).not.toHaveBeenCalled();
    });

    it('updateMany WHERE clause is bound to BOTH optionId AND questionId', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      prismaMock.quizOption.findFirst
        .mockResolvedValueOnce(optionRecord())                  // pre-check getOptionById
        .mockResolvedValueOnce(optionRecord({ text: 'Updated' })); // post-update fetch
      prismaMock.quizOption.updateMany.mockResolvedValue({ count: 1 });

      await request(app)
        .patch(`${OPTIONS_BASE}/option-1`)
        .set('Cookie', cookie())
        .send({ text: 'Updated' });

      expect(prismaMock.quizOption.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'option-1', questionId: 'question-1' }),
        }),
      );
    });
  });

  // ── D: Option from Question B cannot be deleted via Question A ────────────

  describe('D. Option from Question B cannot be deleted through Question A context', () => {
    it('returns 404 when optionId does not belong to the requested questionId', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      prismaMock.quizOption.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .delete(`${OPTIONS_BASE}/option-from-question-b`)
        .set('Cookie', cookie());

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('OPTION_NOT_FOUND');
      expect(prismaMock.quizOption.deleteMany).not.toHaveBeenCalled();
    });

    it('deleteMany WHERE clause is bound to BOTH optionId AND questionId', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      prismaMock.quizOption.findFirst.mockResolvedValue(optionRecord());
      prismaMock.quizOption.deleteMany.mockResolvedValue({ count: 1 });

      await request(app)
        .delete(`${OPTIONS_BASE}/option-1`)
        .set('Cookie', cookie());

      expect(prismaMock.quizOption.deleteMany).toHaveBeenCalledWith({
        where: { id: 'option-1', questionId: 'question-1' },
      });
    });
  });

  // ── E: Correct parent IDs still allow legitimate operations ───────────────

  describe('E. Correct parent IDs allow legitimate update and delete', () => {
    it('successfully updates a question with correct quizId', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findFirst
        .mockResolvedValueOnce(questionDetailRecord())
        .mockResolvedValueOnce(questionDetailRecord({ questionText: 'New text' }));
      prismaMock.question.updateMany.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .patch(`${QUESTIONS_BASE}/question-1`)
        .set('Cookie', cookie())
        .send({ questionText: 'New text' });

      expect(res.status).toBe(200);
      expect(res.body.data.questionText).toBe('New text');
    });

    it('successfully deletes a question with correct quizId', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      prismaMock.question.deleteMany.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .delete(`${QUESTIONS_BASE}/question-1`)
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('successfully updates an option with correct questionId', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      prismaMock.quizOption.findFirst
        .mockResolvedValueOnce(optionRecord())
        .mockResolvedValueOnce(optionRecord({ text: 'New text' }));
      prismaMock.quizOption.updateMany.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .patch(`${OPTIONS_BASE}/option-1`)
        .set('Cookie', cookie())
        .send({ text: 'New text' });

      expect(res.status).toBe(200);
      expect(res.body.data.text).toBe('New text');
    });

    it('successfully deletes an option with correct questionId', async () => {
      await setValidAuth('INSTRUCTOR');
      prismaMock.question.findFirst.mockResolvedValue(questionDetailRecord());
      prismaMock.quizOption.findFirst.mockResolvedValue(optionRecord());
      prismaMock.quizOption.deleteMany.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .delete(`${OPTIONS_BASE}/option-1`)
        .set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ── F: Org → course → module → quiz authorization chain still intact ──────

  describe('F. Full authorization chain remains enforced', () => {
    it('rejects unauthenticated question update (401)', async () => {
      const res = await request(app)
        .patch(`${QUESTIONS_BASE}/question-1`)
        .send({ questionText: 'Hacked' });
      expect(res.status).toBe(401);
      expect(prismaMock.question.updateMany).not.toHaveBeenCalled();
    });

    it('rejects student role on question update (403)', async () => {
      await authenticateAs('STUDENT');
      prismaMock.userOrganization.findUnique.mockResolvedValue(
        membershipRecord({ role: 'STUDENT' }),
      );
      prismaMock.course.findFirst.mockResolvedValue(courseRecord());
      prismaMock.module.findFirst.mockResolvedValue(moduleRecord());
      prismaMock.quiz.findFirst.mockResolvedValue(quizRecord());

      const res = await request(app)
        .patch(`${QUESTIONS_BASE}/question-1`)
        .set('Cookie', cookie())
        .send({ questionText: 'Hacked' });
      expect(res.status).toBe(403);
      expect(prismaMock.question.updateMany).not.toHaveBeenCalled();
    });

    it('rejects cross-org question update (403)', async () => {
      await authenticateAs('INSTRUCTOR', { organizationId: 'org-a' });
      // Not a member of org-b — findUnique returns null
      prismaMock.userOrganization.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/v1/organizations/org-b/courses/course-1/modules/module-1/quizzes/quiz-1/questions/question-1')
        .set('Cookie', cookie())
        .send({ questionText: 'Cross-org injection' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
      expect(prismaMock.question.updateMany).not.toHaveBeenCalled();
    });

    it('rejects update when quiz does not exist in the module (404)', async () => {
      await setValidAuth('INSTRUCTOR');
      // Override: quiz doesn't exist — service throws QUIZ_NOT_FOUND before touching questions
      prismaMock.quiz.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .patch(`${QUESTIONS_BASE}/question-1`)
        .set('Cookie', cookie())
        .send({ questionText: 'Some text' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('QUIZ_NOT_FOUND');
      expect(prismaMock.question.updateMany).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated option delete (401)', async () => {
      const res = await request(app).delete(`${OPTIONS_BASE}/option-1`);
      expect(res.status).toBe(401);
      expect(prismaMock.quizOption.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects cross-org option delete (403)', async () => {
      await authenticateAs('INSTRUCTOR', { organizationId: 'org-a' });
      // requireAuth needs organization.slug in findMany result to filter memberships
      prismaMock.userOrganization.findMany.mockResolvedValue([
        { role: 'INSTRUCTOR', organizationId: 'org-a', userId: 'user-1',
          organization: { slug: 'org-a', id: 'org-a' } },
      ]);
      // Not a member of org-b — findUnique returns null
      prismaMock.userOrganization.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/v1/organizations/org-b/courses/course-1/modules/module-1/quizzes/quiz-1/questions/question-1/options/option-1')
        .set('Cookie', cookie());
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
      expect(prismaMock.quizOption.deleteMany).not.toHaveBeenCalled();
    });
  });
});
