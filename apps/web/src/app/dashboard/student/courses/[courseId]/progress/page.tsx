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

type MeResponse = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string;
    role?: string | null;
    organizationId?: string | null;
  };
};

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

  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function guard() {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const meRes = await fetch(`${apiBase}/api/v1/auth/me`, { credentials: 'include' });
        if (!active) return;
        if (!meRes.ok) {
          window.location.href = '/login';
          return;
        }
        const meData: MeResponse = await meRes.json();
        if (!active) return;
        if (meData.user?.role !== 'STUDENT') {
          window.location.href = '/login';
          return;
        }
        const orgId = meData.user?.organizationId ?? null;
        if (!orgId) {
          window.location.href = '/login';
          return;
        }
        setOrganizationId(orgId);
        if (courseId) await loadProgress(orgId, courseId);
      } catch {
        if (active) window.location.href = '/login';
      } finally {
        if (active) setLoading(false);
      }
    }

    guard();
    return () => {
      active = false;
    };
  }, [courseId]);

  async function loadProgress(orgId: string, cid: string) {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/v1/organizations/${orgId}/student/courses/${cid}/progress`, {
        credentials: 'include',
      });
      if (!res.ok) {
        let code: unknown = null;
        try {
          code = (await res.json())?.error;
        } catch {
          code = null;
        }
        if (code === 'STUDENT_NOT_ENROLLED') {
          setError('You are not enrolled in this course.');
        } else if (code === 'COURSE_NOT_FOUND') {
          setError('Course not found.');
        } else {
          setError('Could not load progress. Please try again.');
        }
        return;
      }
      const body = await res.json();
      setProgress(body.data ?? null);
    } catch {
      setError('Could not reach the server. Please try again.');
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto flex max-w-5xl items-center gap-3 text-neutral-700">
          <Spinner size="lg" label="Loading progress..." />
          <span>Loading progress...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center gap-2 text-sm">
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

        {error ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState
              title="Unable to load progress"
              message={error}
              action={organizationId && courseId ? { label: 'Retry', onClick: () => loadProgress(organizationId, courseId!) } : undefined}
            />
          </div>
        ) : progress ? (
          <>
            <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Course Progress</p>
                  <h1 className="mt-1 text-2xl font-bold text-neutral-900">{progress.courseTitle}</h1>
                </div>
                <Badge variant={progress.courseComplete ? 'success' : 'default'} size="sm">
                  {progress.courseComplete ? 'Completed' : 'In Progress'}
                </Badge>
              </div>

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
          </>
        ) : null}
      </div>
    </main>
  );
}
