'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, postJson, postJsonWithTimeout } from '../../lib/api';
import type { CourseOverview, Order } from '../../lib/types';

export const courseOverviewKey = (organizationId: string, courseId: string) =>
  ['student', 'courses', organizationId, courseId, 'overview'] as const;

export type PaymentMethod = 'COD' | 'BANK_TRANSFER' | 'MOCK' | 'STRIPE';

export function useCourseOverview(organizationId: string, courseId: string) {
  return useQuery({
    queryKey: courseOverviewKey(organizationId, courseId),
    queryFn: async () => {
      const body = await getJson<{ data?: CourseOverview }>(
        `/api/v1/organizations/${organizationId}/student/courses/${courseId}/overview`,
      );
      return body.data ?? null;
    },
    enabled: Boolean(organizationId) && Boolean(courseId),
  });
}

export function useCheckoutOrder(organizationId: string, courseId: string, paymentMethod: PaymentMethod = 'MOCK') {
  return useMutation({
    mutationFn: async () => {
      const body = await postJsonWithTimeout<{ data?: Order & { stripeCheckoutUrl?: string } }>(
        `/api/v1/organizations/${organizationId}/student/courses/${courseId}/checkout`,
        { paymentMethod },
        paymentMethod === 'STRIPE' ? 15000 : 30000,
      );
      return body.data ?? null;
    },
  });
}

export function useCompleteStripePayment(organizationId: string, courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const body = await postJson<{
        data?: {
          orderId: string;
          orderStatus: string;
          totalAmount: number;
          currency: string;
        };
      }>(
        `/api/v1/organizations/${organizationId}/student/courses/${courseId}/stripe/complete`,
        { sessionId },
      );
      return body.data ?? null;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: courseOverviewKey(organizationId, courseId) });
      void queryClient.invalidateQueries({ queryKey: ['student', 'courses', organizationId] });
      void queryClient.invalidateQueries({ queryKey: ['enrollments', organizationId] });
    },
  });
}

export function useSubmitManualPayment(organizationId: string, orderId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentMethod, transactionId }: { paymentMethod: 'COD' | 'BANK_TRANSFER'; transactionId?: string }) => {
      if (!orderId) throw new Error('ORDER_NOT_FOUND');
      const body = await postJson<{ data?: { id: string; status: string; paymentMethod: string; transactionId?: string | null } }>(
        `/api/v1/organizations/${organizationId}/student/orders/${orderId}/manual-payment`,
        { paymentMethod, transactionId },
      );
      return body.data ?? null;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: courseOverviewKey(organizationId, 'all') });
    },
  });
}

export function usePendingManualPayments(organizationId: string) {
  return useQuery({
    queryKey: ['payments', 'pending', organizationId],
    queryFn: async () => {
      const body = await getJson<{ data?: Array<Record<string, unknown>> }>(
        `/api/v1/organizations/${organizationId}/payments/pending`,
      );
      return body.data ?? [];
    },
    enabled: Boolean(organizationId),
  });
}

export function useApproveManualPayment(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const body = await postJson<{ data?: Record<string, unknown> }>(
        `/api/v1/organizations/${organizationId}/payments/${paymentId}/approve`,
        {},
      );
      return body.data ?? null;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payments', 'pending', organizationId] });
    },
  });
}

export function useRejectManualPayment(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      const body = await postJson<{ data?: Record<string, unknown> }>(
        `/api/v1/organizations/${organizationId}/payments/${paymentId}/reject`,
        { reason },
      );
      return body.data ?? null;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payments', 'pending', organizationId] });
    },
  });
}

export function usePayOrder(organizationId: string, courseId: string, orderId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error('ORDER_NOT_FOUND');
      const body = await postJsonWithTimeout<{ data?: { orderId: string; orderStatus: string; totalAmount: number; currency: string } }>(
        `/api/v1/organizations/${organizationId}/student/orders/${orderId}/pay`,
        undefined,
        30000,
      );
      return body.data
        ? { id: body.data.orderId, status: body.data.orderStatus, totalAmount: body.data.totalAmount, currency: body.data.currency, items: [] }
        : null;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: courseOverviewKey(organizationId, courseId) });
      void queryClient.invalidateQueries({ queryKey: ['student', 'courses', organizationId] });
      void queryClient.invalidateQueries({ queryKey: ['enrollments', organizationId] });
    },
  });
}
