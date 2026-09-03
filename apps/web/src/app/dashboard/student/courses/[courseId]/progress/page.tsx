'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Badge,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  Spinner,
} from '@/components/ui';
import { PageHeader } from '@/components/dashboard';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { useProgress } from '@/features/student/useProgress';

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

export default function StudentCourseProgressPage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [markingError, setMarkingError] = useState<string | null>(null);

  // Use React Query hooks for progress
  const { 
    data: progress, 
    isLoading: progressLoading, 
    error: progressError 
  } = useProgress(organizationId ?? '', courseId ?? '');

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

  const isLoading = userLoading || progressLoading;
  const error = progressError?.message;

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
                <div className="mt-6 rounded-lg border-2 border-success-200 bg-success-50 p-4">
                  <h3 className="text-lg font-semibold text-success-900">🎉 Congratulations!</h3>
                  <p className="mt-1 text-sm text-success-700">
                    You have successfully completed all lessons in this course.
                  </p>
                </div>
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
