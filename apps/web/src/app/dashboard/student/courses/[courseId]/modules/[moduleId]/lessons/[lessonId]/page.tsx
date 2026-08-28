'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge, Button, ErrorState, Spinner } from '@/components/ui';

type MeResponse = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string;
    role?: string | null;
    organizationId?: string | null;
  };
};

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
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const moduleId = typeof params.moduleId === 'string' ? params.moduleId : null;
  const lessonId = typeof params.lessonId === 'string' ? params.lessonId : null;

  const [data, setData] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
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
        if (courseId && moduleId && lessonId) {
          await loadLesson(orgId, courseId, moduleId, lessonId);
        }
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
  }, [courseId, moduleId, lessonId]);

  async function markComplete(completed: boolean) {
    if (!organizationId || !courseId || !moduleId || !lessonId) return;
    setMarking(true);
    setMarkError(null);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/student/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/progress`,
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
    } catch {
      setMarkError('Could not reach the server. Please try again.');
    } finally {
      setMarking(false);
    }
  }

  async function loadLesson(orgId: string, cid: string, mid: string, lid: string) {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${orgId}/student/courses/${cid}/modules/${mid}/lessons/${lid}`,
        { credentials: 'include' }
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
        } else {
          setError('Could not load lesson. Please try again.');
        }
        return;
      }
      const body = await res.json();
      setData(body.data ?? null);
    } catch {
      setError('Could not reach the server. Please try again.');
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto flex max-w-5xl items-center gap-3 text-neutral-700">
          <Spinner size="lg" label="Loading lesson..." />
          <span>Loading lesson...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center gap-2 text-sm">
          <Link href="/dashboard/student" className="text-primary-600 hover:text-primary-700">My Courses</Link>
          <span className="text-neutral-400">/</span>
          {data && (
            <>
              <Link href={`/dashboard/student/courses/${courseId}`} className="text-primary-600 hover:text-primary-700">
                {data.course.title}
              </Link>
              <span className="text-neutral-400">/</span>
              <Link href={`/dashboard/student/courses/${courseId}/modules/${moduleId}`} className="text-primary-600 hover:text-primary-700">
                {data.module.title}
              </Link>
              <span className="text-neutral-400">/</span>
            </>
          )}
          <span className="text-neutral-600">{data?.lesson.title ?? 'Lesson'}</span>
        </div>

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
                {data.lesson.type && <Badge variant="primary" size="sm">{data.lesson.type}</Badge>}
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
                <Link
                  href={`/dashboard/student/courses/${courseId}/modules/${moduleId}`}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  &larr; Back to Module
                </Link>
                <div className="flex flex-wrap items-center gap-3">
                  {markError && (
                    <span className="text-sm text-error-600">{markError}</span>
                  )}
                  <Link
                    href={`/dashboard/student/courses/${courseId}/progress`}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    View Course Progress
                  </Link>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={marking}
                    onClick={() => markComplete(true)}
                  >
                    {marking ? 'Saving...' : 'Mark as Complete'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={marking}
                    onClick={() => markComplete(false)}
                  >
                    Mark as Incomplete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
