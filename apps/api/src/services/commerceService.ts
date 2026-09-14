import * as courseRepo from '../repositories/courseRepository';
import * as enrollmentRepo from '../repositories/enrollmentRepository';
import * as orderRepo from '../repositories/orderRepository';
import { processMockPayment } from './paymentService';
import { dispatchNotification } from './notificationDispatcher';
import { getActiveCoursePrice } from '../utils/coursePricing';

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorCode: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorCode)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
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

export async function purchaseCourse(organizationId: string, userId: string, courseId: string) {
  const startedAt = Date.now();
  // These checks are independent reads. Run them together so a slow remote
  // database does not make checkout wait for three sequential round trips.
  const [course, existingEnrollment, existingOrder] = await withTimeout(
    Promise.all([
      courseRepo.getById(organizationId, courseId),
      enrollmentRepo.findByUserAndCourse(userId, courseId),
      orderRepo.findPaidOrderForCourse(userId, courseId),
    ]),
    8000,
    'PURCHASE_DATABASE_TIMEOUT',
  );
  console.info('[PURCHASE] checks completed', { courseId, durationMs: Date.now() - startedAt });
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }

  if (course.status !== 'PUBLISHED') {
    throw new Error('COURSE_NOT_PUBLISHED');
  }

  if (existingEnrollment) {
    throw new Error('ALREADY_ENROLLED');
  }

  if (existingOrder) {
    throw new Error('ALREADY_PURCHASED');
  }

  const unitPrice = getActiveCoursePrice(
    course.price == null ? null : Number(course.price),
    course.discountPrice == null ? null : Number(course.discountPrice),
  );
  const totalAmount = round2(unitPrice);
  const currency = 'USD';

  const payment = await processMockPayment({ amount: totalAmount, currency });
  if (!payment.success) {
    throw new Error('PAYMENT_FAILED');
  }

  const { order, enrollment } = await orderRepo.createOrderWithPurchase({
    userId,
    organizationId,
    courseId: course.id,
    courseTitle: course.title,
    unitPrice,
    totalAmount,
    currency,
    providerRef: payment.providerRef,
  });
  console.info('[PURCHASE] transaction completed', { courseId, durationMs: Date.now() - startedAt });

  // Do not make checkout wait for Redis or email delivery. The order and
  // enrollment are already committed, so notification delivery can continue
  // independently without delaying the purchase response.
  void dispatchNotification({
    type: 'COURSE_PURCHASED',
    title: `Course purchased: ${course.title}`,
    body: `Your purchase of ${course.title} was successful and you are now enrolled.`,
    data: {
      orderId: order.id,
      courseId: course.id,
      courseTitle: course.title,
    },
    userId,
    organizationId,
    email: { courseTitle: course.title },
  });

  return toPurchaseDto(order, enrollment, course);
}
