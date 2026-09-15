import * as courseRepo from '../repositories/courseRepository';
import * as enrollmentRepo from '../repositories/enrollmentRepository';
import * as orderRepo from '../repositories/orderRepository';
import { processMockPayment } from './paymentService';
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

export async function createCheckoutOrder(organizationId: string, userId: string, courseId: string) {
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
    return {
      ...toOrderDto(pendingOrder),
      courseId: course.id,
      courseTitle: course.title,
    };
  }

  const unitPrice = getActiveCoursePrice(
    course.price == null ? null : Number(course.price),
    course.discountPrice == null ? null : Number(course.discountPrice),
  );
  const order = await orderRepo.createPendingOrder({
    userId,
    organizationId,
    courseId: course.id,
    courseTitle: course.title,
    unitPrice,
    totalAmount: round2(unitPrice),
    currency: 'USD',
  });
  return { ...toOrderDto({ ...order, items: [] }), courseId: course.id, courseTitle: course.title };
}

export async function payOrder(organizationId: string, userId: string, orderId: string) {
  const order = await orderRepo.findPendingOrderForUser(orderId, userId, organizationId);
  if (!order) throw new Error('ORDER_NOT_FOUND');
  const payment = await processMockPayment({
    amount: Number(order.totalAmount),
    currency: order.currency,
  });
  if (!payment.success) {
    await orderRepo.failOrder(orderId, userId, organizationId);
    throw new Error('PAYMENT_FAILED');
  }
  const result = await orderRepo.completeOrderWithPurchase({
    orderId,
    userId,
    organizationId,
    providerRef: payment.providerRef,
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
