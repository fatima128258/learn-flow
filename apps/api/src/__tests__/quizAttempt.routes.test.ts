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
  course: {
    findFirst: vi.fn(),
  },
  enrollment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
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
    create: vi.fn(),
    findMany: vi.fn(),
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
    role: 'STUDENT',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function courseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    organizationId: 'org-a',
    instructorUserId: 'instructor-1',
    title: 'Intro to Testing',
    slug: 'intro-to-testing',
    description: 'Learn testing',
    status: 'PUBLISHED',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function enrollmentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'enrollment-1',
    userId: 'user-1',
    courseId: 'course-1',
    organizationId: 'org-a',
    status: 'ACTIVE',
    enrolledAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function moduleRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'module-1',
    courseId: 'course-1',
    title: 'Module One',
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

function quizForTakingRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...quizRecord(),
    questions: [
      {
        id: 'q1',
        questionText: 'What is 2 + 2?',
        marks: 2,
        order: 0,
        options: [
          { id: 'o1', text: '4', order: 0 },
          { id: 'o2', text: '5', order: 1 },
        ],
      },
      {
        id: 'q2',
        questionText: 'What is the capital of France?',
        marks: 1,
        order: 1,
        options: [
          { id: 'o3', text: 'London', order: 0 },
          { id: 'o4', text: 'Paris', order: 1 },
        ],
      },
    ],
    ...overrides,
  };
}

function quizForGradingRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...quizRecord(),
    questions: [
      {
        id: 'q1',
        marks: 2,
        options: [
          { id: 'o1', isCorrect: true },
          { id: 'o2', isCorrect: false },
        ],
      },
      {
        id: 'q2',
        marks: 1,
        options: [
          { id: 'o3', isCorrect: false },
          { id: 'o4', isCorrect: true },
        ],
      },
    ],
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
  prismaMock.course.findFirst.mockReset();
  prismaMock.enrollment.findUnique.mockReset();
  prismaMock.enrollment.findMany.mockReset();
  prismaMock.module.findFirst.mockReset();
  prismaMock.quiz.findFirst.mockReset();
  prismaMock.quiz.findUnique.mockReset();
  prismaMock.quizAttempt.count.mockReset();
  prismaMock.quizAttempt.create.mockReset();
  prismaMock.quizAttempt.findMany.mockReset();
  vi.mocked(authService.getSessionFromToken).mockReset();
  vi.mocked(authService.getUserById).mockReset();
}

const QUIZ_BASE = '/api/v1/organizations/org-a/student/courses/course-1/modules/module-1/quizzes/quiz-1';

async function setValidStudent(overrides: {
  course?: Record<string, unknown>;
  enrollment?: Record<string, unknown>;
  module?: Record<string, unknown>;
  quiz?: Record<string, unknown>;
} = {}) {
  await authenticateAs('STUDENT');
  prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
  prismaMock.course.findFirst.mockResolvedValue(courseRecord(overrides.course));
  prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord(overrides.enrollment));
  prismaMock.module.findFirst.mockResolvedValue(moduleRecord(overrides.module));
  prismaMock.quiz.findFirst.mockResolvedValue(quizRecord(overrides.quiz));
}

describe('GET /api/v1/organizations/:organizationId/student/courses/:courseId/modules/:moduleId/quizzes/:quizId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get(QUIZ_BASE);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('rejects students with unverified email with 403', async () => {
    await authenticateAs('STUDENT', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

    const res = await request(app).get(QUIZ_BASE).set('Cookie', cookie());
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
  });

  it('rejects non-student roles with 403', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ role: 'INSTRUCTOR' }),
    );

    const res = await request(app).get(QUIZ_BASE).set('Cookie', cookie());
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('returns 403 when the student is not enrolled', async () => {
    await setValidStudent();
    prismaMock.enrollment.findUnique.mockResolvedValue(null);

    const res = await request(app).get(QUIZ_BASE).set('Cookie', cookie());
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('STUDENT_NOT_ENROLLED');
  });

  it('returns 403 when the enrollment belongs to another organization', async () => {
    await setValidStudent();
    prismaMock.enrollment.findUnique.mockResolvedValue(
      enrollmentRecord({ organizationId: 'org-b' }),
    );

    const res = await request(app).get(QUIZ_BASE).set('Cookie', cookie());
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('STUDENT_NOT_ENROLLED');
  });

  it('returns 404 when the course does not exist', async () => {
    await setValidStudent();
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app).get(QUIZ_BASE).set('Cookie', cookie());
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
  });

  it('returns 404 when the module does not exist', async () => {
    await setValidStudent();
    prismaMock.module.findFirst.mockResolvedValue(null);

    const res = await request(app).get(QUIZ_BASE).set('Cookie', cookie());
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('MODULE_NOT_FOUND');
  });

  it('returns 404 when the quiz does not exist', async () => {
    await setValidStudent();
    prismaMock.quiz.findFirst.mockResolvedValue(null);

    const res = await request(app).get(QUIZ_BASE).set('Cookie', cookie());
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('QUIZ_NOT_FOUND');
  });

  it('returns quiz questions and options WITHOUT leaking correct answers', async () => {
    await setValidStudent();
    prismaMock.quiz.findUnique.mockResolvedValue(quizForTakingRecord());
    prismaMock.quizAttempt.count.mockResolvedValue(1);

    const res = await request(app).get(QUIZ_BASE).set('Cookie', cookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: 'quiz-1',
      title: 'Test Quiz',
      timeLimitMinutes: 30,
      passingPercentage: 70,
      maxAttempts: 3,
      attempts: { used: 1, remaining: 2 },
    });
    expect(res.body.data.questions).toHaveLength(2);
    expect(res.body.data.questions[0]).toMatchObject({
      id: 'q1',
      questionText: 'What is 2 + 2?',
      marks: 2,
    });
    expect(res.body.data.questions[0].options[0]).toEqual({
      id: 'o1',
      text: '4',
      order: 0,
    });
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('isCorrect');
  });

  it('reports unlimited remaining attempts when maxAttempts is null', async () => {
    await setValidStudent();
    prismaMock.quiz.findUnique.mockResolvedValue(
      quizForTakingRecord({ maxAttempts: null }),
    );
    prismaMock.quizAttempt.count.mockResolvedValue(3);

    const res = await request(app).get(QUIZ_BASE).set('Cookie', cookie());
    expect(res.status).toBe(200);
    expect(res.body.data.attempts).toEqual({ used: 3, remaining: null });
  });
});

describe('POST /api/v1/organizations/:organizationId/student/courses/:courseId/modules/:moduleId/quizzes/:quizId/attempts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).post(`${QUIZ_BASE}/attempts`).send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('rejects non-student roles with 403', async () => {
    await authenticateAs('ORG_ADMIN', { userId: 'admin-1' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ userId: 'admin-1', role: 'ORG_ADMIN' }),
    );

    const res = await request(app)
      .post(`${QUIZ_BASE}/attempts`)
      .set('Cookie', cookie())
      .send({ answers: [] });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('returns 403 when the student is not enrolled', async () => {
    await setValidStudent();
    prismaMock.enrollment.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post(`${QUIZ_BASE}/attempts`)
      .set('Cookie', cookie())
      .send({ answers: [] });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('STUDENT_NOT_ENROLLED');
  });

  it('returns 400 when answers are missing', async () => {
    await setValidStudent();
    const res = await request(app)
      .post(`${QUIZ_BASE}/attempts`)
      .set('Cookie', cookie())
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_FIELDS');
  });

  it('returns 400 when answers are not an array', async () => {
    await setValidStudent();
    const res = await request(app)
      .post(`${QUIZ_BASE}/attempts`)
      .set('Cookie', cookie())
      .send({ answers: 'not-an-array' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_FIELDS');
  });

  it('returns 400 when answers contain invalid entries', async () => {
    await setValidStudent();
    const res = await request(app)
      .post(`${QUIZ_BASE}/attempts`)
      .set('Cookie', cookie())
      .send({ answers: [{ questionId: 'q1' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_ANSWERS');
  });

  it('returns 403 when the student reached max attempts', async () => {
    await setValidStudent();
    prismaMock.quiz.findUnique.mockResolvedValue(quizForGradingRecord());
    prismaMock.quizAttempt.count.mockResolvedValue(3);

    const res = await request(app)
      .post(`${QUIZ_BASE}/attempts`)
      .set('Cookie', cookie())
      .send({ answers: [{ questionId: 'q1', optionId: 'o1' }] });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('MAX_ATTEMPTS_REACHED');
  });

  it('returns 400 when not all questions are answered', async () => {
    await setValidStudent();
    prismaMock.quiz.findUnique.mockResolvedValue(quizForGradingRecord());
    prismaMock.quizAttempt.count.mockResolvedValue(0);

    const res = await request(app)
      .post(`${QUIZ_BASE}/attempts`)
      .set('Cookie', cookie())
      .send({ answers: [{ questionId: 'q1', optionId: 'o1' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ALL_QUESTIONS_REQUIRED');
  });

  it('scores a fully correct attempt and computes pass/fail', async () => {
    await setValidStudent();
    prismaMock.quiz.findUnique.mockResolvedValue(quizForGradingRecord());
    prismaMock.quizAttempt.count.mockResolvedValue(0);
    prismaMock.quizAttempt.create.mockResolvedValue({
      id: 'attempt-1',
      quizId: 'quiz-1',
      userId: 'user-1',
      attemptNumber: 1,
      score: 3,
      correctCount: 2,
      incorrectCount: 0,
      percentage: 100,
      passed: true,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const res = await request(app)
      .post(`${QUIZ_BASE}/attempts`)
      .set('Cookie', cookie())
      .send({
        answers: [
          { questionId: 'q1', optionId: 'o1' },
          { questionId: 'q2', optionId: 'o4' },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      attemptNumber: 1,
      score: 3,
      correctCount: 2,
      incorrectCount: 0,
      percentage: 100,
      passed: true,
      passingPercentage: 70,
      totalMarks: 3,
    });
  });

  it('scores a partially correct attempt against passing threshold', async () => {
    await setValidStudent();
    prismaMock.quiz.findUnique.mockResolvedValue(quizForGradingRecord());
    prismaMock.quizAttempt.count.mockResolvedValue(0);
    prismaMock.quizAttempt.create.mockResolvedValue({
      id: 'attempt-1',
      quizId: 'quiz-1',
      userId: 'user-1',
      attemptNumber: 1,
      score: 1,
      correctCount: 1,
      incorrectCount: 1,
      percentage: 33.33,
      passed: false,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const res = await request(app)
      .post(`${QUIZ_BASE}/attempts`)
      .set('Cookie', cookie())
      .send({
        answers: [
          { questionId: 'q1', optionId: 'o2' },
          { questionId: 'q2', optionId: 'o4' },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      score: 1,
      correctCount: 1,
      incorrectCount: 1,
      percentage: 33.33,
      passed: false,
    });
  });

  it('increments the attempt number on subsequent submissions', async () => {
    await setValidStudent();
    prismaMock.quiz.findUnique.mockResolvedValue(quizForGradingRecord());
    prismaMock.quizAttempt.count.mockResolvedValue(2);
    prismaMock.quizAttempt.create.mockResolvedValue({
      id: 'attempt-3',
      quizId: 'quiz-1',
      userId: 'user-1',
      attemptNumber: 3,
      score: 3,
      correctCount: 2,
      incorrectCount: 0,
      percentage: 100,
      passed: true,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const res = await request(app)
      .post(`${QUIZ_BASE}/attempts`)
      .set('Cookie', cookie())
      .send({
        answers: [
          { questionId: 'q1', optionId: 'o1' },
          { questionId: 'q2', optionId: 'o4' },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.attemptNumber).toBe(3);
    expect(prismaMock.quizAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ attemptNumber: 3 }),
      }),
    );
  });

  it('rejects duplicate simultaneous submissions with 409', async () => {
    await setValidStudent();
    prismaMock.quiz.findUnique.mockResolvedValue(quizForGradingRecord());
    prismaMock.quizAttempt.count.mockResolvedValue(0);
    prismaMock.quizAttempt.create.mockRejectedValue({ code: 'P2002' });

    const res = await request(app)
      .post(`${QUIZ_BASE}/attempts`)
      .set('Cookie', cookie())
      .send({
        answers: [
          { questionId: 'q1', optionId: 'o1' },
          { questionId: 'q2', optionId: 'o4' },
        ],
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ATTEMPT_ALREADY_SUBMITTED');
  });
});
