'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge, Button, ErrorState, PageLoading, Spinner } from '@/components/ui';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { useModuleLessons, useProgress } from '@/features/student/useProgress';
import { useToast } from '@/components/ui/ToastProvider';
import { getNextContentUrl } from '@/features/student/nextContent';

type LessonContent = {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  content: string | null;
  type: string | null;
  duration: number | null;
  order: number;
  isPreview: boolean;
};

type LessonData = {
  enrollmentVerified: boolean;
  lesson: LessonContent;
  module: { id: string; title: string; order: number };
  course: { id: string; title: string };
};

export default function StudentLessonPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const moduleId = typeof params.moduleId === 'string' ? params.moduleId : null;
  const lessonId = typeof params.lessonId === 'string' ? params.lessonId : null;
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const toast = useToast();
  const organizationId = user?.organizationId ?? '';
  const { data: progress, isLoading: progressLoading } = useProgress(organizationId, courseId ?? '');
  const { data: moduleLessons } = useModuleLessons(organizationId, courseId ?? '', moduleId ?? '');

  const [data, setData] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const [nextContentUrl, setNextContentUrl] = useState<string | null>(null);
  const [nextResolving, setNextResolving] = useState(false);
  const [completedLocally, setCompletedLocally] = useState(false);
  const [courseCompleted, setCourseCompleted] = useState(false);
  const moduleLessonCompleted = Boolean(
    lessonId &&
    moduleLessons?.items?.some(
      (item: { type?: string; id?: string; lesson?: { id?: string; isCompleted?: boolean } }) =>
        item.type === 'LESSON' &&
        (item.id === lessonId || item.lesson?.id === lessonId) &&
        item.lesson?.isCompleted === true,
    ),
  );
  const legacyLessonCompleted = Boolean(
    lessonId &&
    moduleLessons?.lessons?.some(
      (lesson: { id?: string; isCompleted?: boolean }) =>
        lesson.id === lessonId && lesson.isCompleted === true,
    ),
  );
  const isCompleted =
    completedLocally ||
    moduleLessonCompleted ||
    legacyLessonCompleted ||
    Boolean(lessonId && progress?.completedLessonIds.includes(lessonId));

  useEffect(() => {
    setNextContentUrl(null);
    setNextResolving(false);
    setCompletedLocally(false);
    setCourseCompleted(false);
    setMarkError(null);
  }, [courseId, moduleId, lessonId]);

  useEffect(() => {
    if (!isCompleted || !organizationId || !courseId || !moduleId || !lessonId || nextContentUrl) return;
    if (completedLocally) return;
    let active = true;
    setNextResolving(true);
    void getNextContentUrl({
      organizationId,
      courseId,
      moduleId,
      contentType: 'LESSON',
      contentId: lessonId,
    }).then(url => {
      if (active) setNextContentUrl(url);
    }).catch(() => {
      if (active) setNextContentUrl(null);
    }).finally(() => {
      if (active) setNextResolving(false);
    });
    return () => {
      active = false;
    };
  }, [isCompleted, completedLocally, organizationId, courseId, moduleId, lessonId, nextContentUrl]);

  async function loadLesson(orgId: string, cid: string, mid: string, lid: string) {
    setLoading(true);
    setError(null);
    try {
      const apiBase = '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${orgId}/student/courses/${cid}/modules/${mid}/lessons/${lid}`,
        { credentials: 'include', cache: 'no-store' }
      );
      if (!res.ok) {
        let code: unknown = null;
        try {
          code = (await res.json())?.error;
        } catch {
          code = null;
        }
        if (code === 'STUDENT_NOT_ENROLLED') {
          setError('You are not enrolled in this course.');
        } else if (code === 'LESSON_NOT_FOUND') {
          setError('Lesson not found.');
        } else if (code === 'MODULE_NOT_FOUND') {
          setError('Module not found.');
        } else if (code === 'CONTENT_LOCKED') {
          setError('This lesson is locked. Complete the previous course item first.');
        } else if (code === 'CONTENT_SEQUENCE_MISSING') {
          setError('This lesson is not available yet. Please return to the module and try again.');
        } else if (code === 'BACKEND_TIMEOUT' || code === 'BACKEND_UNAVAILABLE' || code === 'PROXY_ERROR') {
          setError('The learning server is taking longer than expected. Please try again in a moment.');
        } else {
          setError('Could not load lesson. Please try again.');
        }
        return;
      }
      const body = await res.json();
      setData(body.data ?? null);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Check auth and load lesson - consolidated to single effect
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

    if (!courseId || !moduleId || !lessonId) {
      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
      try {
        setLoading(true);
        // orgId is guaranteed to be non-null by the check above
        await loadLesson(orgId as string, courseId ?? '', moduleId ?? '', lessonId ?? '');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [userLoading, user, courseId, moduleId, lessonId]);

  async function markComplete(completed: boolean) {
    if (!user?.organizationId || !courseId || !moduleId || !lessonId) return;
    setMarking(true);
    setMarkError(null);
    try {
      const apiBase = '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${user.organizationId}/student/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/progress`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ completed }),
        },
      );
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null) as { error?: string } | null;
        const errorCode = errorBody?.error;
        setMarkError(
          res.status === 502 || res.status === 503 || res.status === 504
            ? 'The learning server is waking up. Please click Complete again in a moment.'
            : errorCode === 'CONTENT_LOCKED'
              ? 'This lesson is locked. Complete the previous course item first.'
              : errorCode === 'STUDENT_NOT_ENROLLED'
                ? 'Your enrollment could not be verified. Please refresh and try again.'
            : 'Could not update your progress. Please try again.',
        );
        return;
      }
      const responseBody = await res.json().catch(() => null) as {
        data?: {
          courseProgress?: {
            courseComplete?: boolean;
            contentComplete?: boolean;
            successfulCompletion?: boolean;
          };
        };
      } | null;
      // Reflect the server's accepted state, rather than assuming every
      // progress mutation marks the lesson complete.
      setCompletedLocally(completed);
      const completedCourse =
        responseBody?.data?.courseProgress?.contentComplete === true ||
        responseBody?.data?.courseProgress?.courseComplete === true;
      setCourseCompleted(completedCourse);
      if (completed) {
        toast.toast({
          variant: 'success',
          title: completedCourse ? 'Course completed!' : 'Lesson completed!',
          message: completedCourse
            ? 'Congratulations! You completed the course.'
            : 'Congratulations! You completed this lesson.',
          duration: 5000,
          action: (
            <>
              <button
                type="button"
                onClick={() => void goToNextContent()}
                disabled={nextResolving}
                className="rounded-md bg-[#5A321F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#472719] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {nextResolving ? 'Loading next...' : 'Next'}
              </button>
              {completedCourse && (
                <Link
                  href="/dashboard/student/certificates"
                  className="rounded-md border border-[#5A321F] px-3 py-1.5 text-xs font-semibold text-[#5A321F] hover:bg-[#f7eee8]"
                >
                  Go to Certificate
                </Link>
              )}
            </>
          ),
        });
      }
      if (completed && user.organizationId) {
        // Enable navigation immediately after completion; refine the route in
        // the background when the next-content lookup finishes.
        setNextContentUrl(null);
        setNextResolving(true);
        void getNextContentUrl({
          organizationId: user.organizationId,
          courseId,
          moduleId,
          contentType: 'LESSON',
          contentId: lessonId,
        }).then((nextUrl) => {
          if (!nextUrl) return;
          setNextContentUrl(nextUrl);
          const currentModulePath = `/modules/${moduleId}/`;
          if (!nextUrl.includes(currentModulePath)) {
            router.push(nextUrl);
          }
        }).catch(() => {
          // Next navigation can resolve again when the student clicks it.
        }).finally(() => {
          setNextResolving(false);
        });
      }
    } catch {
      setMarkError('Could not reach the server. Please try again.');
    } finally {
      setMarking(false);
    }
  }

  async function goToNextContent() {
    if (!organizationId || !courseId || !moduleId || !lessonId || !isCompleted) return;
    setNextResolving(true);
    try {
      const localItems = Array.isArray(moduleLessons?.items) ? moduleLessons.items : [];
      const localIndex = localItems.findIndex(
        (item: { type?: string; id?: string }) =>
          item.type === 'LESSON' && item.id === lessonId,
      );
      const localNext = localIndex >= 0 ? localItems[localIndex + 1] : undefined;
      const immediateUrl = localNext?.type && localNext.id &&
        localNext.state !== 'locked' && localNext.unlocked !== false
        ? `/dashboard/student/courses/${courseId}/modules/${moduleId}/${localNext.type === 'LESSON' ? 'lessons' : 'quizzes'}/${localNext.id}`
        : null;
      const url = nextContentUrl ?? immediateUrl ?? await getNextContentUrl({
        organizationId,
        courseId,
        moduleId,
        contentType: 'LESSON',
        contentId: lessonId,
      });
      if (url) {
        setNextContentUrl(url);
        router.push(url);
      }
    } finally {
      setNextResolving(false);
    }
  }

  if (loading) {
    return <PageLoading />;
  }

  return (
    <div className="mx-auto max-w-6xl">
        {error ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState
              title="Unable to load lesson"
              message={error}
            />
          </div>
        ) : data ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="border-b border-neutral-200 p-6">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {data.lesson.isPreview && <Badge variant="info" size="sm">Preview</Badge>}
                {data.lesson.duration != null && (
                  <Badge variant="default" size="sm">{data.lesson.duration} min</Badge>
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <h1 className="min-w-0 text-2xl font-bold text-neutral-900">{data.lesson.title}</h1>
                {isCompleted && <Badge variant="success" size="sm">Completed</Badge>}
              </div>
              {data.lesson.description && (
                <p className="mt-2 text-neutral-600">{data.lesson.description}</p>
              )}
            </div>

            <div className="p-6">
              {data.lesson.content ? (
                <div className="prose prose-neutral max-w-none">
                  <div className="whitespace-pre-wrap text-neutral-800 leading-relaxed">
                    {data.lesson.content}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-neutral-500">
                  <svg className="mx-auto h-12 w-12 text-neutral-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>No content available for this lesson yet.</p>
                </div>
              )}
            </div>

            <div className="border-t border-neutral-200 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div />
                <div className="flex flex-wrap items-center gap-3">
                  {markError && (
                    <span className="text-sm text-error-600">{markError}</span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.back()}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={marking}
                    onClick={() => {
                      if (isCompleted) {
                        void goToNextContent();
                      } else {
                        void markComplete(true);
                      }
                    }}
                  >
                    {marking ? 'Saving...' : isCompleted ? 'Next' : 'Complete'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
  );
}
