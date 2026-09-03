import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = {
  order: { create: vi.fn() },
  orderItem: { create: vi.fn() },
  payment: { create: vi.fn() },
  enrollment: { create: vi.fn() },
};

const prismaMock = {
  userOrganization: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  organization: { findUnique: vi.fn() },
  course: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  enrollment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  order: { findFirst: vi.fn() },
  module: { count: vi.fn() },
  lesson: { count: vi.fn() },
  quiz: { count: vi.fn() },
  notification: { create: vi.fn() },
  $transaction: vi.fn(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock)),
};

vi.mock('../services/authService', () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  logoutSessionByToken: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerificationEmail: vi.fn(),
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
import * as dispatcher from '../services/notificationDispatcher';

const now = new Date('2026-08-28T10:00:00.000Z');
const ORG_ID = 'org-journey';
const COURSE_ID = 'course-js';
const STUDENT_ID = 'student-1';
const COOKIE = ['learnflow_session=journey-token'];

function courseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: COURSE_ID,
    organizationId: ORG_ID,
    instructorUserId: 'instructor-1',
    instructorUser: { id: 'instructor-1', name: 'Dr. Codes' },
    category: { id: 'cat-1', name: 'Development', slug: 'development' },
    title: 'JavaScript Essentials',
    slug: 'javascript-essentials',
    description: 'A complete beginning-to-end JavaScript course.',
    thumbnailUrl: null,
    price: 79.99,
    discountPrice: 39.99,
    status: 'PUBLISHED',
    publishedAt: now,
    estimatedMinutes: 240,
    difficulty: 'Beginner',
    learningObjectives: ['Write modern JS'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function enrollmentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'enrollment-1',
    userId: STUDENT_ID,
    courseId: COURSE_ID,
    organizationId: ORG_ID,
    status: 'ACTIVE',
    enrolledAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function membershipRecord(role: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `mem-${role}-1`,
    userId: STUDENT_ID,
    organizationId: ORG_ID,
    role,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// Configure the authenticated session so every protected endpoint after the
// first auth step sees the same student.
function setAuthenticatedStudent() {
  vi.mocked(authService.getSessionFromToken).mockResolvedValue({
    id: 'session-1',
    userId: STUDENT_ID,
    tokenHash: 'hash',
    expiresAt: new Date(Date.now() + 3600000),
    revoked: false,
    createdAt: now,
    updatedAt: now,
  });
  vi.mocked(authService.getUserById).mockResolvedValue({
    id: STUDENT_ID,
    name: 'Journey Student',
    email: 'journey@example.com',
    passwordHash: 'hash',
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  prismaMock.userOrganization.findMany.mockResolvedValue([
    { role: 'STUDENT', organizationId: ORG_ID, userId: STUDENT_ID },
  ]);
  prismaMock.userOrganization.findFirst.mockImplementation(async ({ where }: { where?: { role?: string; organizationId?: string; userId?: string; id?: string; courseId?: string; moduleId?: string; quizId?: string; status?: string } }) => {
    if (where?.role === 'PLATFORM_ADMIN') return null;
    return null;
  });
  prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord('STUDENT'));
}

function setPublishedCourse() {
  prismaMock.course.findFirst.mockResolvedValue(courseRecord());
  prismaMock.module.count.mockResolvedValue(3);
  prismaMock.lesson.count.mockResolvedValue(15);
  prismaMock.quiz.count.mockResolvedValue(2);
}

function setPurchaseTx() {
  txMock.order.create.mockResolvedValue({
    id: 'order-1',
    userId: STUDENT_ID,
    organizationId: ORG_ID,
    status: 'PAID',
    totalAmount: 39.99,
    currency: 'USD',
    createdAt: now,
    updatedAt: now,
  });
  txMock.orderItem.create.mockResolvedValue({
    id: 'item-1',
    orderId: 'order-1',
    courseId: COURSE_ID,
    courseTitle: 'JavaScript Essentials',
    unitPrice: 39.99,
    quantity: 1,
    lineTotal: 39.99,
  });
  txMock.payment.create.mockResolvedValue({
    id: 'payment-1',
    orderId: 'order-1',
    userId: STUDENT_ID,
    organizationId: ORG_ID,
    provider: 'MOCK',
    amount: 39.99,
    currency: 'USD',
    status: 'SUCCEEDED',
    paidAt: now,
  });
  txMock.enrollment.create.mockResolvedValue(enrollmentRecord());
}

describe('Student purchase journey (register → verify → login → browse → purchase → enrolled)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('drives a complete purchase journey across the public and student APIs', async () => {
    // ---- 1. Public registration -------------------------------------------
    vi.mocked(authService.registerUser).mockResolvedValue({
      user: {
        id: STUDENT_ID,
        name: 'Journey Student',
        email: 'journey@example.com',
        passwordHash: 'hash',
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
        role: 'STUDENT',
        organizationId: 'org-1',
      },
      token: 'verify-token',
      expiresAt: new Date(Date.now() + 3600000),
      needsVerification: true,
    });

    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Journey Student',
        email: 'journey@example.com',
        password: 'supersecret',
        confirmPassword: 'supersecret',
      });

    expect(registerRes.status).toBe(200);
    expect(registerRes.body.user.id).toBe(STUDENT_ID);
    expect(registerRes.headers['set-cookie']).toBeDefined();
    expect(authService.registerUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'journey@example.com' }),
    );

    // ---- 2. Email verification --------------------------------------------
    vi.mocked(authService.verifyEmail).mockResolvedValue({ success: true });

    const verifyRes = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: 'verify-token' });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.message).toContain('verified successfully');
    expect(authService.verifyEmail).toHaveBeenCalledWith(
      'verify-token',
      expect.any(String),
    );

    // ---- 3. Login ----------------------------------------------------------
    vi.mocked(authService.loginUser).mockResolvedValue({
      token: 'journey-token',
      expiresAt: new Date(Date.now() + 3600000),
      user: {
        id: STUDENT_ID,
        name: 'Journey Student',
        email: 'journey@example.com',
        emailVerified: true,
        role: 'STUDENT',
        organizationId: ORG_ID,
        passwordHash: 'hash',
        createdAt: now,
        updatedAt: now,
      },
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'journey@example.com', password: 'supersecret' });

    expect(loginRes.status).toBe(200);
    expect(authService.loginUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'journey@example.com' }),
    );

    // ---- 4. Who am I -------------------------------------------------------
    setAuthenticatedStudent();

    const meRes = await request(app).get('/api/v1/auth/me').set('Cookie', COOKIE);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('journey@example.com');

    // ---- 5. Browse the course catalog overview ----------------------------
    setPublishedCourse();
    prismaMock.enrollment.findUnique.mockResolvedValue(null);

    const overviewRes = await request(app)
      .get(`/api/v1/organizations/${ORG_ID}/student/courses/${COURSE_ID}/overview`)
      .set('Cookie', COOKIE);

    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.success).toBe(true);
    expect(overviewRes.body.data.title).toBe('JavaScript Essentials');
    expect(overviewRes.body.data.price).toBe(79.99);
    expect(overviewRes.body.data.discountPrice).toBe(39.99);
    expect(overviewRes.body.data.moduleCount).toBe(3);
    expect(overviewRes.body.data.lessonCount).toBe(15);
    expect(overviewRes.body.data.isEnrolled).toBe(false);

    // ---- 6. Purchase the course -------------------------------------------
    prismaMock.enrollment.findUnique.mockResolvedValue(null);
    prismaMock.order.findFirst.mockResolvedValue(null);
    setPurchaseTx();

    const purchaseRes = await request(app)
      .post(`/api/v1/organizations/${ORG_ID}/student/courses/${COURSE_ID}/purchase`)
      .set('Cookie', COOKIE);

    expect(purchaseRes.status).toBe(201);
    expect(purchaseRes.body.success).toBe(true);
    expect(purchaseRes.body.data).toMatchObject({
      orderId: 'order-1',
      orderStatus: 'PAID',
      totalAmount: 39.99,
      currency: 'USD',
      enrollmentId: 'enrollment-1',
      enrollmentStatus: 'ACTIVE',
      courseId: COURSE_ID,
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatchNotification).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'COURSE_PURCHASED', userId: STUDENT_ID }),
    );

    // ---- 7. My enrolled courses now lists it -------------------------------
    prismaMock.enrollment.findMany.mockResolvedValue([enrollmentRecord()]);
    setPublishedCourse();

    const enrolledRes = await request(app)
      .get(`/api/v1/organizations/${ORG_ID}/student/courses`)
      .set('Cookie', COOKIE);

    expect(enrolledRes.status).toBe(200);
    expect(enrolledRes.body.success).toBe(true);
    expect(Array.isArray(enrolledRes.body.data)).toBe(true);
    expect(enrolledRes.body.data).toHaveLength(1);
    expect(enrolledRes.body.data[0]).toMatchObject({
      courseId: COURSE_ID,
      title: 'JavaScript Essentials',
    });
  });
});