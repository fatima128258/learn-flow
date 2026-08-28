import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = {
  order: {
    create: vi.fn(),
  },
  orderItem: {
    create: vi.fn(),
  },
  payment: {
    create: vi.fn(),
  },
  enrollment: {
    create: vi.fn(),
  },
};

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
    create: vi.fn(),
  },
  order: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(async (callback: any) => callback(txMock)),
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

const now = new Date('2026-08-28T10:00:00.000Z');

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
    title: 'Intro to Commerce',
    slug: 'intro-to-commerce',
    description: null,
    thumbnailUrl: null,
    category: null,
    price: 50,
    discountPrice: 40,
    status: 'PUBLISHED',
    publishedAt: now,
    estimatedMinutes: null,
    difficulty: null,
    learningObjectives: [],
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
  prismaMock.enrollment.create.mockReset();
  prismaMock.order.findFirst.mockReset();
  txMock.order.create.mockReset();
  txMock.orderItem.create.mockReset();
  txMock.payment.create.mockReset();
  txMock.enrollment.create.mockReset();
  vi.mocked(authService.getSessionFromToken).mockReset();
  vi.mocked(authService.getUserById).mockReset();
}

const PURCHASE_PATH = '/api/v1/organizations/org-a/student/courses/course-1/purchase';

async function setValidPublishedCourse(overrides: Record<string, unknown> = {}) {
  await authenticateAs('STUDENT');
  prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
  prismaMock.course.findFirst.mockResolvedValue(courseRecord(overrides));
  prismaMock.enrollment.findUnique.mockResolvedValue(null);
  prismaMock.order.findFirst.mockResolvedValue(null);

  txMock.order.create.mockResolvedValue({
    id: 'order-1',
    userId: 'user-1',
    organizationId: 'org-a',
    status: 'PAID',
    totalAmount: 40,
    currency: 'USD',
    createdAt: now,
    updatedAt: now,
  });
  txMock.orderItem.create.mockResolvedValue({
    id: 'item-1',
    orderId: 'order-1',
    courseId: 'course-1',
    courseTitle: 'Intro to Commerce',
    unitPrice: 40,
    quantity: 1,
    lineTotal: 40,
  });
  txMock.payment.create.mockResolvedValue({
    id: 'payment-1',
    orderId: 'order-1',
    userId: 'user-1',
    organizationId: 'org-a',
    provider: 'MOCK',
    amount: 40,
    currency: 'USD',
    status: 'SUCCEEDED',
    paidAt: now,
  });
  txMock.enrollment.create.mockResolvedValue(enrollmentRecord());
}

describe('POST /api/v1/organizations/:organizationId/student/courses/:courseId/purchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).post(PURCHASE_PATH);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects students with unverified email with 403', async () => {
    await authenticateAs('STUDENT', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

    const res = await request(app).post(PURCHASE_PATH).set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects non-student roles with 403', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ role: 'INSTRUCTOR' }),
    );

    const res = await request(app).post(PURCHASE_PATH).set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects org admin with 403', async () => {
    await authenticateAs('ORG_ADMIN', { userId: 'admin-1' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ userId: 'admin-1', role: 'ORG_ADMIN' }),
    );

    const res = await request(app)
      .post(PURCHASE_PATH)
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant access with 403', async () => {
    await authenticateAs('STUDENT', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/organizations/org-b/student/courses/course-foreign/purchase')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('returns 404 when the course does not exist', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app).post(PURCHASE_PATH).set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('returns 400 when the course is not published', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord({ status: 'DRAFT' }));

    const res = await request(app).post(PURCHASE_PATH).set('Cookie', cookie());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('COURSE_NOT_PUBLISHED');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('returns 409 when the student is already enrolled', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());

    const res = await request(app).post(PURCHASE_PATH).set('Cookie', cookie());

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ALREADY_ENROLLED');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('returns 409 when a paid order already exists for the course', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(null);
    prismaMock.order.findFirst.mockResolvedValue({
      id: 'order-0',
      userId: 'user-1',
      organizationId: 'org-a',
      status: 'PAID',
    });

    const res = await request(app).post(PURCHASE_PATH).set('Cookie', cookie());

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ALREADY_PURCHASED');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('creates order, order item, payment and enrollment atomically for a published course', async () => {
    await setValidPublishedCourse();

    const res = await request(app).post(PURCHASE_PATH).set('Cookie', cookie());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      orderId: 'order-1',
      orderStatus: 'PAID',
      totalAmount: 40,
      currency: 'USD',
      enrollmentId: 'enrollment-1',
      enrollmentStatus: 'ACTIVE',
      courseId: 'course-1',
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-1',
        organizationId: 'org-a',
        status: 'PAID',
        totalAmount: 40,
      }),
    }));
    expect(txMock.orderItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        orderId: 'order-1',
        courseId: 'course-1',
        unitPrice: 40,
        lineTotal: 40,
      }),
    }));
    expect(txMock.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        orderId: 'order-1',
        userId: 'user-1',
        organizationId: 'org-a',
        provider: 'MOCK',
        amount: 40,
        status: 'SUCCEEDED',
      }),
    }));
    expect(txMock.enrollment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-1',
        courseId: 'course-1',
        organizationId: 'org-a',
      }),
    }));
  });

  it('uses discount price when set, otherwise uses price, computed server-side', async () => {
    await setValidPublishedCourse({ price: 100, discountPrice: 75 });

    const res = await request(app).post(PURCHASE_PATH).set('Cookie', cookie());

    expect(res.status).toBe(201);
    expect(txMock.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ totalAmount: 75 }),
    }));

    resetMocks();
    await setValidPublishedCourse({ price: 100, discountPrice: null });
    txMock.order.create.mockResolvedValue({
      id: 'order-2',
      userId: 'user-1',
      organizationId: 'org-a',
      status: 'PAID',
      totalAmount: 100,
      currency: 'USD',
    });

    const res2 = await request(app).post(PURCHASE_PATH).set('Cookie', cookie());

    expect(res2.status).toBe(201);
    expect(txMock.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ totalAmount: 100 }),
    }));
  });

  it('ignores client-supplied price so the total is server-calculated', async () => {
    await setValidPublishedCourse();

    const res = await request(app)
      .post(PURCHASE_PATH)
      .set('Cookie', cookie())
      .send({ price: 1, totalAmount: 1, discountPrice: 1 });

    expect(res.status).toBe(201);
    expect(txMock.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ totalAmount: 40 }),
    }));
    expect(txMock.orderItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ unitPrice: 40, lineTotal: 40 }),
    }));
    expect(txMock.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: 40 }),
    }));
  });

  it('never trusts client-supplied userId', async () => {
    await setValidPublishedCourse();

    const res = await request(app)
      .post(PURCHASE_PATH)
      .set('Cookie', cookie())
      .send({ userId: 'victim-1' });

    expect(res.status).toBe(201);
    expect(txMock.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'user-1' }),
    }));
  });

  it('never trusts client-supplied organizationId', async () => {
    await setValidPublishedCourse();

    const res = await request(app)
      .post(PURCHASE_PATH)
      .set('Cookie', cookie())
      .send({ organizationId: 'org-b' });

    expect(res.status).toBe(201);
    expect(txMock.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'org-a' }),
    }));
  });
});
