import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/courseRepository', () => ({ getById: vi.fn() }));
vi.mock('../repositories/enrollmentRepository', () => ({ findByUserAndCourse: vi.fn() }));
vi.mock('../repositories/orderRepository', () => ({
  findPendingOrderForUser: vi.fn(),
  failOrder: vi.fn(),
  completeOrderWithPurchase: vi.fn(),
}));

import * as orderRepo from '../repositories/orderRepository';
import { payOrder } from '../services/commerceService';
import { setMockPaymentProcessorForTests } from '../services/paymentService';

const pendingOrder = {
  id: 'order-1',
  status: 'PENDING',
  totalAmount: 25,
  currency: 'USD',
  items: [{ courseId: 'course-1', courseTitle: 'Course' }],
  payments: [{ id: 'payment-1', status: 'PENDING' }],
};

describe('mock payment failure injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orderRepo.findPendingOrderForUser).mockResolvedValue(pendingOrder as never);
    setMockPaymentProcessorForTests(async () => ({ success: false, providerRef: '' }));
  });

  it('fails payment and order without creating enrollment or partial success', async () => {
    await expect(payOrder('org-a', 'student-a', 'order-1')).rejects.toThrow('PAYMENT_FAILED');

    expect(orderRepo.failOrder).toHaveBeenCalledWith('order-1', 'student-a', 'org-a');
    expect(orderRepo.completeOrderWithPurchase).not.toHaveBeenCalled();
  });

  afterEach(() => {
    setMockPaymentProcessorForTests();
  });
});
