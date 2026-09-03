'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Badge,
  Button,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  Spinner,
} from '@/components/ui';
import { PageHeader } from '@/components/dashboard';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { useProgress, useGenerateCertificate, useRecordProgress } from '@/features/student/useProgress';

type ProgressModule = {
  id: string;
  title: string;
  order: number;
  lessonCount: number;
  completedLessons: number;
  percentage: number;
  complete: boolean;
  moduleIndex: number;
};

type ProgressQuiz = {
  quizId: string;
  attempts: number;
  bestPercentage: number | null;
  latestPercentage: number | null;
  passed: boolean;
};

type CourseProgress = {
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
  } | null;
  modules: ProgressModule[];
  quizzes: ProgressQuiz[];
};

function ProgressBar({ percentage, color = 'bg-primary-600' }: { percentage: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, percentage));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function lessonTypeIcon(type: string | null) {
  switch (type?.toLowerCase()) {
    case 'video':
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'article':
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'pdf':
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    default:
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
  }
}

export default function StudentCourseProgressPage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [markingLessonId, setMarkingLessonId] = useState<string | null>(null);
  const [markingError, setMarkingError] = useState<string | null>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());

  // Use React Query hooks for progress and certificate generation
  const { 
    data: progress, 
    isLoading: progressLoading, 
    error: progressError 
  } = useProgress(organizationId ?? '', courseId ?? '');

  const generateCertificateMutation = useGenerateCertificate(organizationId ?? '', courseId ?? '');

  // Check auth and set organizationId
  useEffect(() => {
    if (userLoading) return;
    
    if (!user) {
      window.location.href = '/login';
      return;
    }
    
    if (user.role !== 'STUDENT') {
      window.location.href = '/login';
      return;
    }
    
    const orgId = user.organizationId ?? null;
    if (!orgId) {
      window.location.href = '/login';
      return;
    }
    
    setOrganizationId(orgId);
  }, [user, userLoading]);

  async function handleGenerateCertificate() {
    if (!organizationId || !courseId) return;
    
    try {
      const result = await generateCertificateMutation.mutateAsync();
      if (result?.certificateId) {
        window.location.href = `/dashboard/student/certificates/${result.certificateId}`;
      } else {
        window.location.href = '/dashboard/student/certificates';
      }
    } catch (error) {
      // Error is handled by mutation error state
      console.error('Certificate generation error:', error);
    }
  }

  const isLoading = userLoading || progressLoading;
  const error = progressError?.message || (generateCertificateMutation.error instanceof Error ? generateCertificateMutation.error.message : null);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-5xl items-center gap-3 text-neutral-700">
        <Spinner size="lg" label="Loading progress..." />
        <span>Loading progress...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        subtitle="Course Progress"
        title={progress?.courseTitle ?? 'Course Progress'}
          breadcrumbs={
            <div className="flex items-center gap-2 text-sm">
              <Link href="/dashboard/student" className="text-primary-600 hover:text-primary-700">My Courses</Link>
              <span className="text-neutral-400">/</span>
              {progress && (
                <Link href={`/dashboard/student/courses/${courseId}`} className="text-primary-600 hover:text-primary-700">
                  {progress.courseTitle}
                </Link>
              )}
              <span className="text-neutral-400">/</span>
              <span className="text-neutral-600">Progress</span>
            </div>
          }
          actions={
            progress ? (
              <Badge variant={progress.courseComplete ? 'success' : 'default'} size="sm">
                {progress.courseComplete ? 'Completed' : 'In Progress'}
              </Badge>
            ) : undefined
          }
        />

        {error ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState
              title="Unable to load progress"
              message={error}
              action={
                organizationId && courseId
                  ? {
                      label: 'Retry',
                      onClick: () => {
                        // Manually trigger a refetch by updating state
                        setOrganizationId(null);
                        setTimeout(() => setOrganizationId(organizationId), 0);
                      },
                    }
                  : undefined
              }
            />
          </div>
        ) : progress ? (
          <>
            <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-neutral-600">
                    {progress.completedLessons} of {progress.totalLessons} lessons completed
                  </span>
                  <span className="font-semibold text-neutral-900">{progress.coursePercentage}%</span>
                </div>
                <ProgressBar percentage={progress.coursePercentage} />
              </div>

              <div className="mt-5 flex flex-wrap gap-4 text-sm text-neutral-500">
                <span>{progress.modules.length} module{progress.modules.length !== 1 ? 's' : ''}</span>
                {progress.quizzes.length > 0 && (
                  <span>{progress.quizzes.length} quiz{progress.quizzes.length !== 1 ? 'zes' : ''} taken</span>
                )}
              </div>

              {progress.lastVisited?.lessonId && (
                <div className="mt-5">
                  <Link
                    href={`/dashboard/student/courses/${courseId}/modules/${progress.lastVisited.moduleId}/lessons/${progress.lastVisited.lessonId}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                  >
                    Resume where you left off
                  </Link>
                </div>
              )}

              {progress.courseComplete && (
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button
                    size="md"
                    variant="primary"
                    disabled={generateCertificateMutation.isPending}
                    onClick={handleGenerateCertificate}
                    className="bg-success-600 hover:bg-success-700"
                  >
                    {generateCertificateMutation.isPending ? 'Generating...' : 'Generate Certificate'}
                  </Button>
                  <Link
                    href="/dashboard/student/certificates"
                    className="inline-flex items-center gap-2 rounded-lg border-2 border-primary-600 px-4 py-2 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
                  >
                    View Certificates
                  </Link>
                </div>
              )}
              {generateCertificateMutation.error && (
                <p className="mt-2 text-sm text-error-600">
                  {generateCertificateMutation.error instanceof Error 
                    ? generateCertificateMutation.error.message 
                    : 'Failed to generate certificate'}
                </p>
              )}
            </div>

            <h2 className="mb-4 text-lg font-semibold text-neutral-900">Modules</h2>
            {progress.modules.length === 0 ? (
              <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <EmptyState
                  icon={EmptyStateIcons.NoData}
                  title="No modules yet"
                  description="The instructor hasn't added any modules to this course yet."
                />
              </div>
            ) : (
              <div className="space-y-3">
                {progress.modules.map((module) => (
                  <div key={module.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-sm font-bold text-primary-700">
                          {module.moduleIndex + 1}
                        </div>
                        <div>
                          <h3 className="font-semibold text-neutral-900">{module.title}</h3>
                          <p className="text-sm text-neutral-500">
                            {module.completedLessons} of {module.lessonCount} lessons
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {module.complete && <Badge variant="success" size="sm">Complete</Badge>}
                        <span className="text-sm font-semibold text-neutral-900">{module.percentage}%</span>
                      </div>
                    </div>
                    <ProgressBar
                      percentage={module.percentage}
                      color={module.complete ? 'bg-success-500' : 'bg-primary-600'}
                    />
                  </div>
                ))}
              </div>
            )}

            {progress.quizzes.length > 0 && (
              <>
                <h2 className="mb-4 mt-8 text-lg font-semibold text-neutral-900">Quizzes</h2>
                <div className="space-y-2">
                  {progress.quizzes.map((quiz) => (
                    <div key={quiz.quizId} className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <Badge variant="default" size="sm">Quiz</Badge>
                        <span className="font-medium text-neutral-900">
                          {quiz.attempts} attempt{quiz.attempts !== 1 ? 's' : ''}
                        </span>
                        <Badge variant={quiz.passed ? 'success' : 'warning'} size="sm">
                          {quiz.passed ? 'Passed' : 'Not passed'}
                        </Badge>
                      </div>
                      <span className="text-sm font-semibold text-neutral-900">
                        Best: {quiz.bestPercentage == null ? '—' : `${Math.round(quiz.bestPercentage)}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <h2 className="mb-4 mt-8 text-lg font-semibold text-neutral-900">Mark Lessons as Viewed</h2>
            <div className="space-y-3">
              {progress.modules.length === 0 ? (
                <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
                  <EmptyState
                    icon={EmptyStateIcons.NoData}
                    title="No modules yet"
                    description="The instructor hasn't added any modules to this course yet."
                  />
                </div>
              ) : (
                progress.modules.map((module) => (
                  <div key={module.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-sm font-bold text-primary-700">
                          {module.moduleIndex + 1}
                        </div>
                        <div>
                          <h3 className="font-semibold text-neutral-900">{module.title}</h3>
                          <p className="text-sm text-neutral-500">
                            {module.completedLessons} of {module.lessonCount} lessons completed ({module.percentage}%)
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/dashboard/student/courses/${courseId}/modules/${module.id}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                      >
                        View & Mark Lessons
                      </Link>
                    </div>
                    <ProgressBar
                      percentage={module.percentage}
                      color={module.complete ? 'bg-success-500' : 'bg-primary-600'}
                    />
                  </div>
                ))
              )}
            </div>

            {markingError && (
              <div className="mt-4 rounded-lg border border-error-200 bg-error-50 p-3">
                <p className="text-sm text-error-700">{markingError}</p>
                <button
                  onClick={() => setMarkingError(null)}
                  className="mt-2 text-sm text-error-600 hover:text-error-700"
                >
                  Dismiss
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
  );
}
