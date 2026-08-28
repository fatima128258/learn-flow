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
  });
}
