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
  paymentMethod?: 'COD' | 'BANK_TRANSFER' | 'MOCK' | null;
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

    const paymentMethod = data.paymentMethod && data.paymentMethod !== 'MOCK' ? data.paymentMethod : null;

    await tx.payment.create({
      data: {
        orderId: order.id,
        userId: data.userId,
        organizationId: data.organizationId,
        provider: paymentMethod ?? 'MOCK',
        amount: data.totalAmount,
        currency: data.currency,
        status: 'PENDING',
        paymentMethod: paymentMethod ?? undefined,
        transactionId: null,
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

export async function findPendingManualPaymentById(paymentId: string, organizationId: string) {
  return prisma().payment.findFirst({
    where: {
      id: paymentId,
      organizationId,
      status: 'PENDING',
      paymentMethod: { in: ['COD', 'BANK_TRANSFER'] },
    },
    include: {
      order: {
        include: { items: true },
      },
    },
  });
}

export async function listPendingManualPayments(organizationId: string) {
  return prisma().payment.findMany({
    where: {
      organizationId,
      status: 'PENDING',
      paymentMethod: { in: ['COD', 'BANK_TRANSFER'] },
    },
    include: {
      order: {
        include: { items: true },
      },
      user: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function listPaymentsForUser(userId: string, organizationId: string) {
  return prisma().payment.findMany({
    where: { userId, organizationId },
    include: {
      order: {
        include: { items: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function submitManualPayment(data: {
  orderId: string;
  userId: string;
  organizationId: string;
  paymentMethod: 'COD' | 'BANK_TRANSFER';
  transactionId?: string | null;
}) {
  return prisma().$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: data.orderId, userId: data.userId, organizationId: data.organizationId, status: 'PENDING' },
      include: { payments: true },
    });
    if (!order) throw new Error('ORDER_NOT_FOUND');

    const payment = order.payments[0];
    if (!payment) throw new Error('PAYMENT_NOT_FOUND');
    if (payment.status !== 'PENDING') throw new Error('PAYMENT_NOT_PENDING');
    if (payment.paymentMethod && payment.paymentMethod !== data.paymentMethod) {
      throw new Error('PAYMENT_METHOD_MISMATCH');
    }

    const nextTxId = data.paymentMethod === 'BANK_TRANSFER' ? (data.transactionId ?? '').trim() : (data.transactionId ?? '').trim() || null;
    if (data.paymentMethod === 'BANK_TRANSFER' && !nextTxId) {
      throw new Error('INVALID_TRANSACTION_ID');
    }

    await tx.payment.updateMany({
      where: { id: payment.id, orderId: order.id, userId: data.userId, status: 'PENDING' },
      data: {
        paymentMethod: data.paymentMethod,
        transactionId: nextTxId,
        provider: 'MANUAL',
      },
    });

    const updated = await tx.payment.findUnique({ where: { id: payment.id } });
    return updated;
  });
}

export async function approveManualPayment(data: {
  paymentId: string;
  organizationId: string;
  reviewerUserId: string;
}) {
  return prisma().$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: {
        id: data.paymentId,
        organizationId: data.organizationId,
        status: 'PENDING',
        paymentMethod: { in: ['COD', 'BANK_TRANSFER'] },
      },
      include: { order: { include: { items: true } } },
    });
    if (!payment) throw new Error('PAYMENT_NOT_FOUND');
    if (!payment.order) throw new Error('ORDER_NOT_FOUND');

    const item = payment.order.items[0];
    if (!item) throw new Error('ORDER_ITEM_NOT_FOUND');

    const existingEnrollment = await tx.enrollment.findUnique({
      where: { userId_courseId: { userId: payment.userId, courseId: item.courseId } },
    });
    if (existingEnrollment) throw new Error('ALREADY_ENROLLED');

    const paymentUpdate = await tx.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: 'SUCCEEDED',
        reviewedById: data.reviewerUserId,
        reviewedAt: new Date(),
        rejectionReason: null,
        paidAt: new Date(),
        providerRef: `manual_approval_${Date.now()}`,
      },
    });
    if (paymentUpdate.count !== 1) throw new Error('PAYMENT_NOT_PENDING');

    const orderUpdate = await tx.order.updateMany({
      where: { id: payment.orderId, status: 'PENDING' },
      data: { status: 'PAID' },
    });
    if (orderUpdate.count !== 1) throw new Error('ORDER_NOT_PENDING');

    const enrollment = await tx.enrollment.create({
      data: {
        userId: payment.userId,
        courseId: item.courseId,
        organizationId: payment.organizationId,
      },
    });

    const updatedPayment = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    return { payment: updatedPayment, enrollment };
  });
}

export async function rejectManualPayment(data: {
  paymentId: string;
  organizationId: string;
  reviewerUserId: string;
  reason?: string | null;
}) {
  return prisma().$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: {
        id: data.paymentId,
        organizationId: data.organizationId,
        status: 'PENDING',
        paymentMethod: { in: ['COD', 'BANK_TRANSFER'] },
      },
      include: { order: true },
    });
    if (!payment) throw new Error('PAYMENT_NOT_FOUND');

    const paymentUpdate = await tx.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: 'FAILED',
        reviewedById: data.reviewerUserId,
        reviewedAt: new Date(),
        rejectionReason: data.reason?.trim() || 'Rejected by owner',
      },
    });
    if (paymentUpdate.count !== 1) throw new Error('PAYMENT_NOT_PENDING');

    const orderUpdate = await tx.order.updateMany({
      where: { id: payment.orderId, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
    if (orderUpdate.count !== 1) throw new Error('ORDER_NOT_PENDING');

    const updatedPayment = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    return updatedPayment;
  });
}

export async function completeOrderWithPurchase(data: {
  orderId: string;
  userId: string;
  organizationId: string;
  providerRef: string;
  paymentMethod?: 'COD' | 'BANK_TRANSFER' | 'MOCK';
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
    const paymentMethod = data.paymentMethod === 'COD' || data.paymentMethod === 'BANK_TRANSFER'
      ? data.paymentMethod
      : payment.paymentMethod ?? undefined;

    const paymentClaim = await tx.payment.updateMany({
      where: { id: payment.id, orderId: order.id, userId: data.userId, status: 'PENDING' },
      data: {
        status: 'SUCCEEDED',
        providerRef: data.providerRef,
        paidAt,
        reviewedAt: paidAt,
        reviewedById: data.userId,
        ...(paymentMethod ? { paymentMethod } : {}),
      },
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
