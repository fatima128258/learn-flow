'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, postJson } from '../../lib/api';
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

export function usePurchaseCourse(organizationId: string, courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const body = await postJson<{ data?: Order }>(
        `/api/v1/organizations/${organizationId}/student/courses/${courseId}/purchase`,
        undefined,
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
