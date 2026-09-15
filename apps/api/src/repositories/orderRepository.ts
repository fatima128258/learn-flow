import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

export interface PurchaseOrderData {
  userId: string;
  organizationId: string;
  courseId: string;
  courseTitle: string;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  providerRef: string;
}

export interface PendingOrderData {
  userId: string;
  organizationId: string;
  courseId: string;
  courseTitle: string;
  unitPrice: number;
  totalAmount: number;
  currency: string;
}

export async function createPendingOrder(data: PendingOrderData) {
  return prisma().$transaction(async (tx) => {
    // Serialize checkout creation per student/course so concurrent Buy Now
    // requests cannot create multiple pending orders for the same purchase.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${data.userId}:${data.organizationId}:${data.courseId}`}, 0))`;
    const existing = await tx.order.findFirst({
      where: {
        userId: data.userId,
        organizationId: data.organizationId,
        status: 'PENDING',
        items: { some: { courseId: data.courseId } },
      },
      include: { items: true, payments: true },
    });
    if (existing) return existing;

    const order = await tx.order.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        status: 'PENDING',
        totalAmount: data.totalAmount,
        currency: data.currency,
      },
    });

    await tx.orderItem.create({
      data: {
        orderId: order.id,
        courseId: data.courseId,
        courseTitle: data.courseTitle,
        unitPrice: data.unitPrice,
        quantity: 1,
        lineTotal: data.totalAmount,
      },
    });

    await tx.payment.create({
      data: {
        orderId: order.id,
        userId: data.userId,
        organizationId: data.organizationId,
        provider: 'MOCK',
        amount: data.totalAmount,
        currency: data.currency,
        status: 'PENDING',
      },
    });

    return order;
  });
}

export async function findPendingOrderForUser(orderId: string, userId: string, organizationId: string) {
  return prisma().order.findFirst({
    where: { id: orderId, userId, organizationId, status: 'PENDING' },
    include: { items: true, payments: true },
  });
}

export async function findPendingOrderForCourse(userId: string, organizationId: string, courseId: string) {
  return prisma().order.findFirst({
    where: {
      userId,
      organizationId,
      status: 'PENDING',
      items: { some: { courseId } },
    },
    include: { items: true, payments: true },
  });
}

export async function completeOrderWithPurchase(data: {
  orderId: string;
  userId: string;
  organizationId: string;
  providerRef: string;
}) {
  return prisma().$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: data.orderId, userId: data.userId, organizationId: data.organizationId },
      include: { items: true, payments: true },
    });
    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (order.status === 'PAID') {
      const enrollment = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId: data.userId, courseId: order.items[0].courseId } },
      });
      if (!enrollment) throw new Error('ORDER_ALREADY_PAID');
      return { order, enrollment };
    }
    if (order.status !== 'PENDING') throw new Error('ORDER_NOT_PENDING');

    const item = order.items[0];
    const enrollment = await tx.enrollment.findUnique({
      where: { userId_courseId: { userId: data.userId, courseId: item.courseId } },
    });
    if (enrollment) throw new Error('ALREADY_ENROLLED');

    const payment = order.payments[0];
    if (!payment) throw new Error('PAYMENT_NOT_FOUND');
    if (payment.status !== 'PENDING') throw new Error('PAYMENT_NOT_PENDING');

    const paidAt = new Date();
    const paymentClaim = await tx.payment.updateMany({
      where: { id: payment.id, orderId: order.id, userId: data.userId, status: 'PENDING' },
      data: { status: 'SUCCEEDED', providerRef: data.providerRef, paidAt },
    });
    if (paymentClaim.count !== 1) throw new Error('PAYMENT_NOT_PENDING');

    const orderClaim = await tx.order.updateMany({
      where: { id: order.id, userId: data.userId, organizationId: data.organizationId, status: 'PENDING' },
      data: { status: 'PAID' },
    });
    if (orderClaim.count !== 1) throw new Error('ORDER_NOT_PENDING');

    const paidOrder = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
    const createdEnrollment = await tx.enrollment.create({
      data: {
        userId: data.userId,
        courseId: item.courseId,
        organizationId: data.organizationId,
      },
    });
    return { order: paidOrder, enrollment: createdEnrollment };
  });
}

export async function failOrder(orderId: string, userId: string, organizationId: string) {
  return prisma().$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId, organizationId, status: 'PENDING' },
      include: { payments: true },
    });
    if (!order) throw new Error('ORDER_NOT_FOUND');
    await tx.payment.updateMany({
      where: { orderId: order.id, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
    return tx.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });
  });
}

export async function findPaidOrderForCourse(userId: string, courseId: string) {
  return prisma().order.findFirst({
    where: {
      userId,
      status: 'PAID',
      items: {
        some: { courseId },
      },
    },
  });
}

export async function createOrderWithPurchase(data: PurchaseOrderData) {
  return prisma().$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        status: 'PAID',
        totalAmount: data.totalAmount,
        currency: data.currency,
      },
    });

    await tx.orderItem.create({
      data: {
        orderId: order.id,
        courseId: data.courseId,
        courseTitle: data.courseTitle,
        unitPrice: data.unitPrice,
        quantity: 1,
        lineTotal: data.totalAmount,
      },
    });

    await tx.payment.create({
      data: {
        orderId: order.id,
        userId: data.userId,
        organizationId: data.organizationId,
        provider: 'MOCK',
        providerRef: data.providerRef,
        amount: data.totalAmount,
        currency: data.currency,
        status: 'SUCCEEDED',
        paidAt: new Date(),
      },
    });

    const enrollment = await tx.enrollment.create({
      data: {
        userId: data.userId,
        courseId: data.courseId,
        organizationId: data.organizationId,
      },
    });

    return {
      order,
      enrollment,
    };
  }, {
    maxWait: 5000,
    timeout: 10000,
  });
}
