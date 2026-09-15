'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, postJsonWithTimeout } from '../../lib/api';
import type { CourseOverview, Order } from '../../lib/types';

export const courseOverviewKey = (organizationId: string, courseId: string) =>
  ['student', 'courses', organizationId, courseId, 'overview'] as const;

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

export function useCheckoutOrder(organizationId: string, courseId: string) {
  return useMutation({
    mutationFn: async () => {
      const body = await postJsonWithTimeout<{ data?: Order }>(
        `/api/v1/organizations/${organizationId}/student/courses/${courseId}/checkout`,
        undefined,
        30000,
      );
      return body.data ?? null;
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
