'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge, Button, ErrorState, Spinner } from '@/components/ui';
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
        setMarkError('Could not update your progress. Please try again.');
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
      setCompletedLocally(true);
      setCourseCompleted(
        responseBody?.data?.courseProgress?.contentComplete === true ||
        responseBody?.data?.courseProgress?.courseComplete === true,
      );
      if (completed && data?.module.order === 1) {
        toast.success('Congratulations! You completed the first module.');
      }
      if (completed && user.organizationId) {
        // Enable navigation immediately after completion; refine the route in
        // the background when the next-content lookup finishes.
        setNextContentUrl(null);
        setNextResolving(false);
        try {
          const nextUrl = await getNextContentUrl({
            organizationId: user.organizationId,
            courseId,
            moduleId,
            contentType: 'LESSON',
            contentId: lessonId,
          });
          if (nextUrl) setNextContentUrl(nextUrl);
        } catch {
          // The module fallback is already available for navigation.
        }
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
      const url = nextContentUrl ?? await getNextContentUrl({
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
    return (
      <div className="mx-auto flex max-w-5xl items-center gap-3 text-neutral-700">
        <Spinner size="lg" label="Loading lesson..." />
        <span>Loading lesson...</span>
      </div>
    );
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
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {data.lesson.isPreview && <Badge variant="info" size="sm">Preview</Badge>}
                {data.lesson.duration != null && (
                  <Badge variant="default" size="sm">{data.lesson.duration} min</Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold text-neutral-900">{data.lesson.title}</h1>
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
                    variant="primary"
                    disabled={marking}
                    onClick={() => markComplete(true)}
                  >
                    {marking ? 'Saving...' : isCompleted ? 'Completed' : 'Complete'}
                  </Button>
                  {isCompleted && courseCompleted && (
                    <div className="w-full rounded-lg border border-[#d9eadf] bg-[#f4fbf6] px-4 py-3 text-sm font-semibold text-[#16834b]">
                      Congratulations! You completed the course.
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!isCompleted || marking}
                    onClick={goToNextContent}
                  >
                    {nextResolving ? 'Loading next...' : 'Next'}
                  </Button>
                  {isCompleted && courseCompleted ? (
                    <Link
                      href="/dashboard/student/certificates"
                      className="inline-flex items-center rounded-lg bg-[#5A321F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#472719]"
                    >
                      Go to Certificate
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
  );
}
