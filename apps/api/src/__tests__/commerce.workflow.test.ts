import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUserOrganizationFindFirst = vi.fn();

vi.mock('../prisma', () => ({
  default: () => ({
    userOrganization: {
      findFirst: mockUserOrganizationFindFirst,
    },
  }),
}));

vi.mock('../repositories/courseRepository', () => ({
  getById: vi.fn(),
}));
vi.mock('../repositories/enrollmentRepository', () => ({
  findByUserAndCourse: vi.fn(),
}));
vi.mock('../repositories/orderRepository', () => ({
  findPaidOrderForCourse: vi.fn(),
  findPendingOrderForCourse: vi.fn(),
  createPendingOrder: vi.fn(),
  findPendingOrderForUser: vi.fn(),
  failOrder: vi.fn(),
  completeOrderWithPurchase: vi.fn(),
  submitManualPayment: vi.fn(),
  findPendingManualPaymentById: vi.fn(),
  listPendingManualPayments: vi.fn(),
  approveManualPayment: vi.fn(),
  rejectManualPayment: vi.fn(),
}));
vi.mock('../services/paymentService', () => ({
  processMockPayment: vi.fn(),
}));

import * as courseRepo from '../repositories/courseRepository';
import * as enrollmentRepo from '../repositories/enrollmentRepository';
import * as orderRepo from '../repositories/orderRepository';
import { processMockPayment } from '../services/paymentService';
import {
  createCheckoutOrder,
  payOrder,
  submitManualPayment,
  approveManualPayment,
  rejectManualPayment,
} from '../services/commerceService';

const course = {
  id: 'course-1',
  title: 'Intro to Commerce',
  status: 'PUBLISHED',
  price: 100,
  discountPrice: 75,
};

const pendingOrder = {
  id: 'order-1',
  status: 'PENDING',
  totalAmount: 75,
  currency: 'USD',
  items: [{ id: 'item-1', courseId: 'course-1', courseTitle: course.title, unitPrice: 75, quantity: 1, lineTotal: 75 }],
  payments: [{ id: 'payment-1', status: 'PENDING' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUserOrganizationFindFirst.mockResolvedValue(null);
  vi.mocked(courseRepo.getById).mockResolvedValue(course as never);
  vi.mocked(enrollmentRepo.findByUserAndCourse).mockResolvedValue(null);
  vi.mocked(orderRepo.findPaidOrderForCourse).mockResolvedValue(null);
  vi.mocked(orderRepo.findPendingOrderForCourse).mockResolvedValue(null);
});

describe('mock checkout workflow', () => {
  it('creates a pending order using the backend course price', async () => {
    vi.mocked(orderRepo.createPendingOrder).mockResolvedValue(pendingOrder as never);

    const result = await createCheckoutOrder('org-a', 'student-a', 'course-1');

    expect(result).toMatchObject({ id: 'order-1', status: 'PENDING', totalAmount: 75 });
    expect(orderRepo.createPendingOrder).toHaveBeenCalledWith(expect.objectContaining({
      unitPrice: 75,
      totalAmount: 75,
    }));
  });

  it('reuses an existing pending order for concurrent checkout requests', async () => {
    vi.mocked(orderRepo.findPendingOrderForCourse).mockResolvedValue(pendingOrder as never);

    const [first, second] = await Promise.all([
      createCheckoutOrder('org-a', 'student-a', 'course-1'),
      createCheckoutOrder('org-a', 'student-a', 'course-1'),
    ]);

    expect(first.id).toBe('order-1');
    expect(second.id).toBe('order-1');
    expect(orderRepo.createPendingOrder).not.toHaveBeenCalled();
  });

  it('marks payment and order successful and returns the enrollment', async () => {
    vi.mocked(orderRepo.findPendingOrderForUser).mockResolvedValue(pendingOrder as never);
    vi.mocked(processMockPayment).mockResolvedValue({ success: true, providerRef: 'mock-ref' });
    vi.mocked(orderRepo.completeOrderWithPurchase).mockResolvedValue({
      order: { ...pendingOrder, status: 'PAID' },
      enrollment: { id: 'enrollment-1', status: 'ACTIVE' },
    } as never);

    const result = await payOrder('org-a', 'student-a', 'order-1');

    expect(result).toMatchObject({
      orderId: 'order-1',
      orderStatus: 'PAID',
      enrollmentId: 'enrollment-1',
    });
    expect(orderRepo.completeOrderWithPurchase).toHaveBeenCalledWith({
      orderId: 'order-1',
      userId: 'student-a',
      organizationId: 'org-a',
      providerRef: 'mock-ref',
      paymentMethod: 'MOCK',
    });
  });

  it('fails the order without creating an enrollment when mock payment fails', async () => {
    vi.mocked(orderRepo.findPendingOrderForUser).mockResolvedValue(pendingOrder as never);
    vi.mocked(processMockPayment).mockResolvedValue({ success: false, providerRef: '' });

    await expect(payOrder('org-a', 'student-a', 'order-1')).rejects.toThrow('PAYMENT_FAILED');

    expect(orderRepo.failOrder).toHaveBeenCalledWith('order-1', 'student-a', 'org-a');
    expect(orderRepo.completeOrderWithPurchase).not.toHaveBeenCalled();
  });

  it('does not retry a failed order as a successful payment', async () => {
    vi.mocked(orderRepo.findPendingOrderForUser).mockResolvedValue(null);

    await expect(payOrder('org-a', 'student-a', 'order-1')).rejects.toThrow('ORDER_NOT_FOUND');
    expect(orderRepo.completeOrderWithPurchase).not.toHaveBeenCalled();
  });

  it('rejects checkout for an already enrolled student', async () => {
    vi.mocked(enrollmentRepo.findByUserAndCourse).mockResolvedValue({ id: 'enrollment-1' } as never);

    await expect(createCheckoutOrder('org-a', 'student-a', 'course-1'))
      .rejects.toThrow('ALREADY_ENROLLED');

    expect(orderRepo.createPendingOrder).not.toHaveBeenCalled();
  });

  it('supports bank transfer checkout as a pending manual payment', async () => {
    vi.mocked(orderRepo.createPendingOrder).mockResolvedValue(pendingOrder as never);

    const result = await createCheckoutOrder('org-a', 'student-a', 'course-1', 'BANK_TRANSFER');

    expect(result).toMatchObject({ id: 'order-1', status: 'PENDING' });
    expect(orderRepo.createPendingOrder).toHaveBeenCalledWith(expect.objectContaining({
      paymentMethod: 'BANK_TRANSFER',
    }));
  });

  it('keeps manual payment pending until owner approval', async () => {
    vi.mocked(orderRepo.findPendingOrderForUser).mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
      totalAmount: 75,
      currency: 'USD',
      items: [{ id: 'item-1', courseId: 'course-1', courseTitle: course.title, unitPrice: 75, quantity: 1, lineTotal: 75 }],
      payments: [{ id: 'payment-1', status: 'PENDING', paymentMethod: 'BANK_TRANSFER', transactionId: 'TX-123' }],
    } as never);

    await expect(payOrder('org-a', 'student-a', 'order-1')).rejects.toThrow('MANUAL_PAYMENT_PENDING_REVIEW');
    expect(orderRepo.completeOrderWithPurchase).not.toHaveBeenCalled();
  });

  it('stores transaction ID for manual payment submission without creating an enrollment', async () => {
    const result = { id: 'payment-1', status: 'PENDING', paymentMethod: 'BANK_TRANSFER', transactionId: 'TX-123' };
    vi.mocked(orderRepo.findPendingOrderForUser).mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
      totalAmount: 75,
      currency: 'USD',
      items: [{ courseId: 'course-1', courseTitle: course.title }],
      payments: [{ id: 'payment-1', status: 'PENDING', paymentMethod: 'BANK_TRANSFER' }],
    } as never);
    vi.mocked(orderRepo.submitManualPayment).mockResolvedValue(result as never);

    await expect(submitManualPayment('org-a', 'student-a', 'order-1', 'BANK_TRANSFER', ' TX-123 ')).resolves.toEqual(result);
    expect(orderRepo.submitManualPayment).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: 'TX-123',
      paymentMethod: 'BANK_TRANSFER',
    }));
  });

  it('approves manual payment when reviewer is the course instructor', async () => {
    vi.mocked(orderRepo.findPendingManualPaymentById).mockResolvedValue({
      id: 'payment-1',
      organizationId: 'org-a',
      userId: 'student-a',
      status: 'PENDING',
      paymentMethod: 'BANK_TRANSFER',
      transactionId: 'TX-123',
      order: {
        id: 'order-1',
        status: 'PENDING',
        items: [{ id: 'item-1', courseId: 'course-1', courseTitle: course.title }],
      },
    } as never);
    vi.mocked(courseRepo.getById).mockResolvedValue({
      id: 'course-1',
      organizationId: 'org-a',
      instructorUserId: 'instructor-a',
      title: course.title,
      status: 'PUBLISHED',
    } as never);
    vi.mocked(orderRepo.approveManualPayment).mockResolvedValue({ payment: { id: 'payment-1', status: 'SUCCEEDED' }, enrollment: { id: 'enrollment-1', status: 'ACTIVE' } } as never);

    await expect(approveManualPayment('org-a', 'instructor-a', 'payment-1')).resolves.toMatchObject({
      payment: { id: 'payment-1', status: 'SUCCEEDED' },
    });
  });

  it('rejects approval by unauthorized reviewer', async () => {
    vi.mocked(orderRepo.findPendingManualPaymentById).mockResolvedValue({
      id: 'payment-1',
      organizationId: 'org-a',
      userId: 'student-a',
      status: 'PENDING',
      paymentMethod: 'BANK_TRANSFER',
      transactionId: 'TX-123',
      order: {
        id: 'order-1',
        status: 'PENDING',
        items: [{ id: 'item-1', courseId: 'course-1', courseTitle: course.title }],
      },
    } as never);
    vi.mocked(courseRepo.getById).mockResolvedValue({
      id: 'course-1',
      organizationId: 'org-a',
      instructorUserId: 'other-instructor',
      title: course.title,
      status: 'PUBLISHED',
    } as never);

    await expect(approveManualPayment('org-a', 'student-a', 'payment-1')).rejects.toThrow('FORBIDDEN');
    expect(orderRepo.approveManualPayment).not.toHaveBeenCalled();
  });

  it('rejects manual payment without creating an enrollment', async () => {
    vi.mocked(orderRepo.findPendingManualPaymentById).mockResolvedValue({
      id: 'payment-1',
      organizationId: 'org-a',
      userId: 'student-a',
      status: 'PENDING',
      paymentMethod: 'COD',
      transactionId: 'TX-123',
      order: {
        id: 'order-1',
        status: 'PENDING',
        items: [{ id: 'item-1', courseId: 'course-1', courseTitle: course.title }],
      },
    } as never);
    vi.mocked(courseRepo.getById).mockResolvedValue({
      id: 'course-1',
      organizationId: 'org-a',
      instructorUserId: 'instructor-a',
      title: course.title,
      status: 'PUBLISHED',
    } as never);
    vi.mocked(orderRepo.rejectManualPayment).mockResolvedValue({ id: 'payment-1', status: 'FAILED' } as never);

    await expect(rejectManualPayment('org-a', 'instructor-a', 'payment-1', 'Incorrect transfer')).resolves.toMatchObject({
      id: 'payment-1',
      status: 'FAILED',
    });
  });
});
