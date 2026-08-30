import * as courseRepo from '../repositories/courseRepository';
import * as enrollmentRepo from '../repositories/enrollmentRepository';
import * as orderRepo from '../repositories/orderRepository';
import { processMockPayment } from './paymentService';
import { dispatchNotification } from './notificationDispatcher';

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

export async function purchaseCourse(organizationId: string, userId: string, courseId: string) {
  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }

  if (course.status !== 'PUBLISHED') {
    throw new Error('COURSE_NOT_PUBLISHED');
  }

  const existingEnrollment = await enrollmentRepo.findByUserAndCourse(userId, courseId);
  if (existingEnrollment) {
    throw new Error('ALREADY_ENROLLED');
  }

  const existingOrder = await orderRepo.findPaidOrderForCourse(userId, courseId);
  if (existingOrder) {
    throw new Error('ALREADY_PURCHASED');
  }

  const rawPrice = course.discountPrice != null ? course.discountPrice : course.price;
  const unitPrice = rawPrice == null ? 0 : Number(rawPrice);
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

  await dispatchNotification({
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
