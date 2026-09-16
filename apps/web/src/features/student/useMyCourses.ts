import { useQuery } from '@tanstack/react-query';
import { ApiError, getJson } from '../../lib/api';

function retryTransientStudentRequest(failureCount: number, error: unknown) {
  if (!(error instanceof ApiError)) return failureCount < 2;
  return (error.status === 0 || error.status >= 500) && failureCount < 2;
}

export type StudentStats = {
  availableCourses: number;
  enrolledCourses: number;
  certificatesEarned: number;
  completedCourses: number;
  inProgressCourses: number;
  categoriesExplored: number;
  totalEstimatedMinutes: number;
  totalEstimatedHours: number;
};

export type EnrolledCourse = {
  enrollmentId: string;
  enrollmentStatus: string;
  enrolledAt: string;
  courseId: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  category: string | null;
  difficulty: string | null;
  instructorName: string | null;
  estimatedMinutes: number | null;
  learningObjectives: string[];
};

/**
 * Query hook for fetching student's enrolled courses.
 * Uses React Query for automatic cache management and invalidation.
 */
export function useMyCourses(organizationId: string) {
  return useQuery({
    queryKey: ['student', 'courses', organizationId],
    queryFn: async () => {
      const body = await getJson<{ data?: EnrolledCourse[] }>(
        `/api/v1/organizations/${organizationId}/student/courses`,
      );
      return body.data ?? [];
    },
    enabled: Boolean(organizationId),
    // Stale time: 30 seconds - refetch if data is older than this
    staleTime: 30 * 1000,
    // Cache time: 5 minutes - keep data in cache for this long
    gcTime: 5 * 60 * 1000,
    retry: retryTransientStudentRequest,
    retryDelay: attemptIndex => Math.min(2000 * 2 ** attemptIndex, 10000),
  });
}

/**
 * Query hook for fetching student statistics.
 * Used alongside useMyCourses to display dashboard stats.
 */
export function useMyStats(organizationId: string) {
  return useQuery({
    queryKey: ['student', 'stats', organizationId],
    queryFn: async () => {
      const body = await getJson<{ data?: StudentStats }>(
        `/api/v1/organizations/${organizationId}/student/stats`,
      );
      return body.data ?? null;
    },
    enabled: Boolean(organizationId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: retryTransientStudentRequest,
    retryDelay: attemptIndex => Math.min(2000 * 2 ** attemptIndex, 10000),
  });
}
