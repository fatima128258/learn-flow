import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, getJson, postJson } from '../../lib/api';

function retryDelay(attemptIndex: number) {
  return Math.min(5000 * 2 ** attemptIndex, 15000);
}

function retryTransientQuery(failureCount: number, error: unknown) {
  if (error instanceof ApiError && [401, 403, 429].includes(error.status)) {
    return false;
  }
  return failureCount < 3;
}

/**
 * Types for course progress tracking
 */
export type ProgressModule = {
  id: string;
  title: string;
  order: number;
  lessonCount: number;
  completedLessons: number;
  totalContentItems: number;
  completedContentItems: number;
  percentage: number;
  complete: boolean;
  moduleIndex: number;
  completedItemCount?: number;
  requiredItemCount?: number;
  items?: ProgressItem[];
};

export type ProgressItem = {
  id: string;
  type: 'LESSON' | 'QUIZ';
  title: string;
  order: number;
  completed: boolean;
  failed?: boolean;
};

export type ProgressQuiz = {
  quizId: string;
  title: string;
  attempts: number;
  bestPercentage: number | null;
  latestPercentage: number | null;
  passed: boolean;
  failed?: boolean;
  attemptsRemaining?: number | null;
  results: Array<{
    attemptNumber: number;
    score: number | null;
    percentage: number | null;
    passed: boolean | null;
    submittedAt: string | null;
  }>;
};

export type CourseProgress = {
  courseId: string;
  courseTitle: string;
  organizationId: string;
  totalLessons: number;
  completedLessons: number;
  totalContentItems: number;
  completedContentItems: number;
  coursePercentage: number;
  courseComplete: boolean;
  contentComplete?: boolean;
  successfulCompletion?: boolean;
  enrollmentStatus: string;
  completedLessonIds: string[];
  lastVisited: {
    moduleId: string | null;
    lessonId: string | null;
    lastVisitedAt: string | null;
  } | null;
  modules: ProgressModule[];
  quizzes: ProgressQuiz[];
  courseThumbnail?: string | null;
  courseStatus?: string;
};

export function useStudentProgress(organizationId: string) {
  return useQuery({
    queryKey: ['student', 'progress', organizationId],
    queryFn: async () => {
      const body = await getJson<{ data?: CourseProgress[] }>(
        `/api/v1/organizations/${organizationId}/student/progress`,
      );
      return body.data ?? [];
    },
    enabled: Boolean(organizationId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: retryTransientQuery,
    retryDelay,
  });
}

export type RecordProgressResponse = {
  lessonId: string;
  moduleId: string;
  courseId: string;
  completed: boolean;
  courseProgress: {
    coursePercentage: number;
    courseComplete: boolean;
    completedLessons: number;
    totalLessons: number;
  };
};

export type Certificate = {
  certificateId: string;
  verificationToken: string;
  verificationUrl: string;
  courseId: string;
  courseTitle: string;
  organizationId: string;
  organizationName: string;
  instructorName: string;
  studentName: string;
  completionDate: string;
  issuedAt: string;
  pdfUrl?: string;
  pdfDownloadUrl?: string;
};

/**
 * Query hook for fetching course progress.
 * Returns detailed progress including modules, lessons, and quiz attempts.
 */
export function useProgress(organizationId: string, courseId: string) {
  return useQuery({
    queryKey: ['student', 'progress', organizationId, courseId],
    queryFn: async () => {
      const body = await getJson<{ data?: CourseProgress }>(
        `/api/v1/organizations/${organizationId}/student/courses/${courseId}/progress`,
      );
      return body.data ?? null;
    },
    enabled: Boolean(organizationId) && Boolean(courseId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: retryTransientQuery,
    retryDelay,
  });
}

/**
 * Query hook for fetching lessons in a module with completion status.
 */
export function useModuleLessons(organizationId: string, courseId: string, moduleId: string) {
  return useQuery({
    queryKey: ['student', 'lessons', organizationId, courseId, moduleId],
    queryFn: async () => {
      const body = await getJson<{ data?: any }>(
        `/api/v1/organizations/${organizationId}/student/courses/${courseId}/modules/${moduleId}/lessons`,
      );
      return body.data ?? null;
    },
    enabled: Boolean(organizationId && courseId && moduleId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: retryTransientQuery,
    retryDelay,
  });
}

/**
 * Mutation hook for recording lesson progress.
 * Marks a lesson as viewed/completed and updates course progress.
 */
export function useRecordProgress(organizationId: string, courseId: string, moduleId: string, lessonId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (completed: boolean = true) => {
      const body = await postJson<{ data?: RecordProgressResponse }>(
        `/api/v1/organizations/${organizationId}/student/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/progress`,
        { completed },
      );
      return body.data ?? null;
    },
    onSuccess: () => {
      // Invalidate progress query to refetch updated data
      void queryClient.invalidateQueries({ 
        queryKey: ['student', 'progress', organizationId, courseId] 
      });
      // Also invalidate lessons query to get updated completion status
      void queryClient.invalidateQueries({ 
        queryKey: ['student', 'lessons', organizationId, courseId, moduleId] 
      });
    },
  });
}

/**
 * Query hook for fetching student's certificates.
 */
export function useCertificates(organizationId: string) {
  return useQuery({
    queryKey: ['student', 'certificates', organizationId],
    queryFn: async () => {
      const body = await getJson<{ data?: Certificate[] }>(
        `/api/v1/organizations/${organizationId}/student/certificates`,
      );
      return body.data ?? [];
    },
    enabled: Boolean(organizationId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 3,
    retryDelay,
  });
}

/**
 * Mutation hook for generating a certificate.
 * Only works when course progress is 100% (all lessons completed).
 */
export function useGenerateCertificate(organizationId: string, courseId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const body = await postJson<{ data?: Certificate }>(
        `/api/v1/organizations/${organizationId}/student/courses/${courseId}/certificate`,
        {},
      );
      return body.data ?? null;
    },
    onSuccess: () => {
      // Invalidate both progress and certificates queries
      void queryClient.invalidateQueries({ 
        queryKey: ['student', 'progress', organizationId, courseId] 
      });
      void queryClient.invalidateQueries({ 
        queryKey: ['student', 'certificates', organizationId] 
      });
    },
  });
}
