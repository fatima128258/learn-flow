import { beforeEach, describe, expect, it, vi } from 'vitest';

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
}));
vi.mock('../services/paymentService', () => ({
  processMockPayment: vi.fn(),
}));

import * as courseRepo from '../repositories/courseRepository';
import * as enrollmentRepo from '../repositories/enrollmentRepository';
import * as orderRepo from '../repositories/orderRepository';
import { processMockPayment } from '../services/paymentService';
import { createCheckoutOrder, payOrder } from '../services/commerceService';

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
});
