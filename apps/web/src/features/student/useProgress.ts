import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, postJson } from '../../lib/api';

/**
 * Types for course progress tracking
 */
export type ProgressModule = {
  id: string;
  title: string;
  order: number;
  lessonCount: number;
  completedLessons: number;
  percentage: number;
  complete: boolean;
  moduleIndex: number;
};

export type ProgressQuiz = {
  quizId: string;
  attempts: number;
  bestPercentage: number | null;
  latestPercentage: number | null;
  passed: boolean;
};

export type CourseProgress = {
  courseId: string;
  courseTitle: string;
  organizationId: string;
  totalLessons: number;
  completedLessons: number;
  coursePercentage: number;
  courseComplete: boolean;
  enrollmentStatus: string;
  lastVisited: {
    moduleId: string | null;
    lessonId: string | null;
    lastVisitedAt: string | null;
  } | null;
  modules: ProgressModule[];
  quizzes: ProgressQuiz[];
};

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
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
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
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
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
