import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, postJson, deleteJson } from '../../lib/api';
import type { Enrollment } from '../../lib/types';

export function useEnrollments(organizationId: string) {
  return useQuery({
    queryKey: ['enrollments', organizationId],
    queryFn: async () => {
      const body = await getJson<{ data?: Enrollment[] }>(
        `/api/v1/organizations/${organizationId}/enrollments`,
      );
      return body.data ?? [];
    },
    enabled: Boolean(organizationId),
  });
}

export function useEnrollment(organizationId: string, courseId: string) {
  return useQuery({
    queryKey: ['enrollment', organizationId, courseId],
    queryFn: async () => {
      const body = await getJson<{ data?: Enrollment }>(
        `/api/v1/organizations/${organizationId}/enrollments/${courseId}`,
      );
      return body.data ?? null;
    },
    enabled: Boolean(organizationId) && Boolean(courseId),
  });
}

export function useEnroll(organizationId: string, courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const body = await postJson<{ data?: Enrollment }>(
        `/api/v1/organizations/${organizationId}/enrollments/${courseId}`,
        undefined,
      );
      return body.data ?? null;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrollment', organizationId, courseId] });
      void queryClient.invalidateQueries({ queryKey: ['enrollments', organizationId] });
      void queryClient.invalidateQueries({ queryKey: ['courseOverview', organizationId, courseId] });
      void queryClient.invalidateQueries({ queryKey: ['courseSearch', organizationId] });
    },
  });
}

export function usePurchase(organizationId: string, courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const body = await postJson<{ data?: { enrollmentId: string; orderId: string; courseId: string } }>(
        `/api/v1/organizations/${organizationId}/student/courses/${courseId}/purchase`,
        {},
      );
      return body.data ?? null;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrollment', organizationId, courseId] });
      void queryClient.invalidateQueries({ queryKey: ['enrollments', organizationId] });
      void queryClient.invalidateQueries({ queryKey: ['courseOverview', organizationId, courseId] });
      void queryClient.invalidateQueries({ queryKey: ['courseSearch', organizationId] });
    },
  });
}

export function useUnenroll(organizationId: string, courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const body = await deleteJson<{ success?: boolean }>(
        `/api/v1/organizations/${organizationId}/enrollments/${courseId}`,
      );
      return body;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrollment', organizationId, courseId] });
      void queryClient.invalidateQueries({ queryKey: ['enrollments', organizationId] });
      void queryClient.invalidateQueries({ queryKey: ['courseOverview', organizationId, courseId] });
      void queryClient.invalidateQueries({ queryKey: ['courseSearch', organizationId] });
    },
  });
}