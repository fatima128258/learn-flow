import * as courseRepo from '../repositories/courseRepository';
import * as enrollmentRepo from '../repositories/enrollmentRepository';
import * as orderRepo from '../repositories/orderRepository';
import getPrisma from '../prisma';
import { processMockPayment } from './paymentService';
import * as stripeService from './stripeService';
import { getActiveCoursePrice } from '../utils/coursePricing';

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function toPurchaseDto(
  order: { id: string; status: string; totalAmount: { toString(): string }; currency?: string },
  enrollment: { id: string; status: string },
  course: { id: string; title: string },
) {
  return {
    orderId: order.id,
    orderStatus: order.status,
    totalAmount: Number(order.totalAmount),
    currency: order.currency,
    enrollmentId: enrollment.id,
    enrollmentStatus: enrollment.status,
    courseId: course.id,
    courseTitle: course.title,
  };
}

function toOrderDto(order: {
  id: string;
  status: string;
  totalAmount: { toString(): string };
  currency?: string;
  items?: Array<{ id: string; courseId: string; courseTitle: string; unitPrice: { toString(): string }; quantity: number; lineTotal: { toString(): string } }>;
}) {
  return {
    id: order.id,
    status: order.status,
    totalAmount: Number(order.totalAmount),
    currency: order.currency ?? 'USD',
    items: (order.items ?? []).map((item) => ({
      id: item.id,
      courseId: item.courseId,
      title: item.courseTitle,
      price: Number(item.unitPrice),
      quantity: item.quantity,
      lineTotal: Number(item.lineTotal),
    })),
  };
}

export async function createCheckoutOrder(
  organizationId: string,
  userId: string,
  courseId: string,
  paymentMethod?: 'COD' | 'BANK_TRANSFER' | 'MOCK' | 'STRIPE',
) {
  const [course, existingEnrollment, existingOrder] = await Promise.all([
    courseRepo.getById(organizationId, courseId),
    enrollmentRepo.findByUserAndCourse(userId, courseId),
    orderRepo.findPaidOrderForCourse(userId, courseId),
  ]);
  if (!course) throw new Error('COURSE_NOT_FOUND');
  if (course.status !== 'PUBLISHED') throw new Error('COURSE_NOT_PUBLISHED');
  if (existingEnrollment) throw new Error('ALREADY_ENROLLED');
  if (existingOrder) throw new Error('ALREADY_PURCHASED');

  const pendingOrder = await orderRepo.findPendingOrderForCourse(userId, organizationId, courseId);
  if (pendingOrder) {
    const pendingPayment = pendingOrder.payments[0];
    if (paymentMethod === 'STRIPE') {
      if (!pendingPayment || pendingPayment.paymentMethod !== 'STRIPE') {
        throw new Error('CHECKOUT_ALREADY_EXISTS');
      }
      if (pendingPayment.providerRef) {
        const existingSession = await stripeService.retrieveCheckoutSession(pendingPayment.providerRef);
        if (existingSession.status === 'open' && existingSession.url) {
          return {
            ...toOrderDto(pendingOrder),
            courseId: course.id,
            courseTitle: course.title,
            stripeCheckoutUrl: existingSession.url,
          };
        }
      }
    } else {
      return {
        ...toOrderDto(pendingOrder),
        courseId: course.id,
        courseTitle: course.title,
      };
    }
  }

  const unitPrice = getActiveCoursePrice(
    course.price == null ? null : Number(course.price),
    course.discountPrice == null ? null : Number(course.discountPrice),
  );
  const order = pendingOrder ?? await orderRepo.createPendingOrder({
    userId,
    organizationId,
    courseId: course.id,
    courseTitle: course.title,
    unitPrice,
    totalAmount: round2(unitPrice),
    currency: 'USD',
    paymentMethod,
  });

  if (paymentMethod === 'STRIPE') {
    const stripeOrder = await orderRepo.findPendingOrderForCourse(userId, organizationId, courseId);
    const payment = stripeOrder?.payments[0];
    if (!stripeOrder || !payment || payment.paymentMethod !== 'STRIPE') {
      throw new Error('PAYMENT_NOT_FOUND');
    }
    const session = await stripeService.createCheckoutSession({
      orderId: stripeOrder.id,
      paymentId: payment.id,
      userId,
      organizationId,
      courseId: course.id,
      courseTitle: course.title,
      amount: Number(stripeOrder.totalAmount),
      currency: stripeOrder.currency,
    });
    if (!session.url) throw new Error('STRIPE_CHECKOUT_UNAVAILABLE');
    await orderRepo.setStripeCheckoutSession({
      orderId: stripeOrder.id,
      paymentId: payment.id,
      userId,
      organizationId,
      sessionId: session.id,
    });
    return {
      ...toOrderDto(stripeOrder),
      courseId: course.id,
      courseTitle: course.title,
      stripeCheckoutUrl: session.url,
    };
  }
  return { ...toOrderDto({ ...order, items: [] }), courseId: course.id, courseTitle: course.title };
}

export async function completeStripePayment(
  organizationId: string,
  userId: string,
  courseId: string,
  sessionId: string,
) {
  const session = await stripeService.retrieveCheckoutSession(sessionId);
  const metadata = session.metadata ?? {};
  const orderId = metadata.orderId;
  const paymentId = metadata.paymentId;
  if (
    session.mode !== 'payment' ||
    session.payment_status !== 'paid' ||
    metadata.userId !== userId ||
    metadata.organizationId !== organizationId ||
    metadata.courseId !== courseId ||
    !orderId ||
    !paymentId
  ) {
    throw new Error('STRIPE_SESSION_INVALID');
  }

  const order = await orderRepo.findOrderForUser(orderId, userId, organizationId);
  if (!order) throw new Error('ORDER_NOT_FOUND');
  const item = order.items[0];
  const payment = order.payments[0];
  if (!item || item.courseId !== courseId || !payment || payment.id !== paymentId) {
    throw new Error('STRIPE_SESSION_INVALID');
  }
  if (payment.providerRef !== sessionId) {
    throw new Error('STRIPE_SESSION_INVALID');
  }
  if (
    session.amount_total !== Math.round(Number(order.totalAmount) * 100) ||
    session.currency?.toLowerCase() !== order.currency.toLowerCase()
  ) {
    throw new Error('STRIPE_SESSION_INVALID');
  }

  const result = await orderRepo.completeOrderWithPurchase({
    orderId: order.id,
    userId,
    organizationId,
    providerRef: session.id,
    paymentMethod: 'STRIPE',
  });
  return toPurchaseDto(result.order, result.enrollment, {
    id: item.courseId,
    title: item.courseTitle,
  });
}

export async function submitManualPayment(
  organizationId: string,
  userId: string,
  orderId: string,
  paymentMethod: 'COD' | 'BANK_TRANSFER',
  transactionId?: string | null,
) {
  const order = await orderRepo.findPendingOrderForUser(orderId, userId, organizationId);
  if (!order) throw new Error('ORDER_NOT_FOUND');

  const payment = order.payments[0];
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');
  if (payment.status !== 'PENDING') throw new Error('PAYMENT_NOT_PENDING');

  const normalizedTxId = (transactionId ?? '').trim();
  if (!normalizedTxId && paymentMethod === 'BANK_TRANSFER') {
    throw new Error('INVALID_TRANSACTION_ID');
  }

  return orderRepo.submitManualPayment({
    orderId,
    userId,
    organizationId,
    paymentMethod,
    transactionId: normalizedTxId || null,
  });
}

export async function listPendingManualPayments(organizationId: string, reviewerUserId: string) {
  const payments = await orderRepo.listPendingManualPayments(organizationId);
  const prisma = getPrisma();

  const [reviewerIsOrgAdmin, reviewerIsPlatformAdmin] = await Promise.all([
    prisma.userOrganization.findFirst({
      where: { userId: reviewerUserId, organizationId, role: 'ORG_ADMIN' },
    }),
    prisma.userOrganization.findFirst({
      where: { userId: reviewerUserId, organizationId, role: 'PLATFORM_ADMIN' },
    }),
  ]);
  const courses = await courseRepo.getByIds(
    organizationId,
    [...new Set(payments.map((payment) => payment.order.items[0]?.courseId).filter(Boolean))],
  );
  const coursesById = new Map(courses.map((course) => [course.id, course]));

  const visible = payments.map((payment) => {
    const courseId = payment.order.items[0]?.courseId;
    if (!courseId) return null;

    const canReview = reviewerIsOrgAdmin || reviewerIsPlatformAdmin
      || coursesById.get(courseId)?.instructorUserId === reviewerUserId;
    return canReview ? payment : null;
  });

  return visible.filter((payment): payment is NonNullable<typeof payment> => Boolean(payment));
}

export async function listOrganizationPayments(organizationId: string, reviewerUserId: string) {
  const payments = await orderRepo.listOrganizationPayments(organizationId);
  const prisma = getPrisma();
  const [reviewerIsOrgAdmin, reviewerIsPlatformAdmin] = await Promise.all([
    prisma.userOrganization.findFirst({
      where: { userId: reviewerUserId, organizationId, role: 'ORG_ADMIN' },
    }),
    prisma.userOrganization.findFirst({
      where: { userId: reviewerUserId, organizationId, role: 'PLATFORM_ADMIN' },
    }),
  ]);
  const courses = await courseRepo.getByIds(
    organizationId,
    [...new Set(payments.map((payment) => payment.order.items[0]?.courseId).filter(Boolean))],
  );
  const coursesById = new Map(courses.map((course) => [course.id, course]));

  const visible = payments.map((payment) => {
    const courseId = payment.order.items[0]?.courseId;
    if (!courseId) return null;
    const canReview = reviewerIsOrgAdmin || reviewerIsPlatformAdmin
      || coursesById.get(courseId)?.instructorUserId === reviewerUserId;
    return canReview ? payment : null;
  });

  return visible.filter((payment): payment is NonNullable<typeof payment> => Boolean(payment));
}

export async function listPaymentsForStudent(organizationId: string, userId: string) {
  const payments = await orderRepo.listPaymentsForUser(userId, organizationId);
  return payments.map((payment) => ({
    id: payment.id,
    status: payment.status,
    paymentMethod: payment.paymentMethod,
    transactionId: payment.transactionId,
    amount: Number(payment.amount),
    currency: payment.currency,
    createdAt: payment.createdAt,
    reviewedAt: payment.reviewedAt,
    rejectionReason: payment.rejectionReason,
    order: {
      id: payment.order.id,
      status: payment.order.status,
      items: payment.order.items.map((item) => ({
        courseId: item.courseId,
        courseTitle: item.courseTitle,
        thumbnailUrl: item.course.thumbnailUrl,
      })),
    },
  }));
}

async function assertReviewAuthorization(
  organizationId: string,
  reviewerUserId: string,
  paymentId: string,
) {
  const prisma = getPrisma();
  const payment = await orderRepo.findPendingManualPaymentById(paymentId, organizationId);
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');

  const courseId = payment.order.items[0]?.courseId;
  if (!courseId) throw new Error('ORDER_ITEM_NOT_FOUND');

  const [course, hasOrgAdmin, hasPlatformAdmin] = await Promise.all([
    courseRepo.getById(organizationId, courseId),
    prisma.userOrganization.findFirst({
      where: { userId: reviewerUserId, organizationId, role: 'ORG_ADMIN' },
    }),
    prisma.userOrganization.findFirst({
      where: { userId: reviewerUserId, organizationId, role: 'PLATFORM_ADMIN' },
    }),
  ]);
  if (!course) throw new Error('COURSE_NOT_FOUND');

  if (hasOrgAdmin || hasPlatformAdmin || course.instructorUserId === reviewerUserId) {
    return payment;
  }

  throw new Error('FORBIDDEN');
}

export async function approveManualPayment(organizationId: string, reviewerUserId: string, paymentId: string) {
  await assertReviewAuthorization(organizationId, reviewerUserId, paymentId);
  return orderRepo.approveManualPayment({
    paymentId,
    organizationId,
    reviewerUserId,
  });
}

export async function rejectManualPayment(
  organizationId: string,
  reviewerUserId: string,
  paymentId: string,
  reason?: string | null,
) {
  await assertReviewAuthorization(organizationId, reviewerUserId, paymentId);
  return orderRepo.rejectManualPayment({
    paymentId,
    organizationId,
    reviewerUserId,
    reason,
  });
}

export async function payOrder(organizationId: string, userId: string, orderId: string) {
  const order = await orderRepo.findPendingOrderForUser(orderId, userId, organizationId);
  if (!order) throw new Error('ORDER_NOT_FOUND');

  const payment = order.payments[0];
  const method = payment?.paymentMethod ?? 'MOCK';

  if (method === 'COD' || method === 'BANK_TRANSFER') {
    throw new Error('MANUAL_PAYMENT_PENDING_REVIEW');
  }

  const mockPayment = await processMockPayment({
    amount: Number(order.totalAmount),
    currency: order.currency,
  });
  if (!mockPayment.success) {
    await orderRepo.failOrder(orderId, userId, organizationId);
    throw new Error('PAYMENT_FAILED');
  }
  const result = await orderRepo.completeOrderWithPurchase({
    orderId,
    userId,
    organizationId,
    providerRef: mockPayment.providerRef,
    paymentMethod: 'MOCK',
  });
  return toPurchaseDto(result.order, result.enrollment, {
    id: order.items[0].courseId,
    title: order.items[0].courseTitle,
  });
}

/** @deprecated The direct purchase operation is intentionally disabled. */
export async function purchaseCourse(_organizationId: string, _userId: string, _courseId: string) {
  throw new Error('LEGACY_PURCHASE_DISABLED');
}
