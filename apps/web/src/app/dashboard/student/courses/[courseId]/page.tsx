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

type MeResponse = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string;
    role?: string | null;
    organizationId?: string | null;
  };
};

type CourseModule = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  lessonCount: number;
};

type CourseDetail = {
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
  estimatedMinutes: number | null;
  learningObjectives: string[];
  modules: CourseModule[];
};

export default function StudentCoursePage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;

  const [course, setCourse] = useState<CourseDetail | null>(null);
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
        if (courseId) await loadCourse(orgId, courseId);
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

  async function loadCourse(orgId: string, cid: string) {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/v1/organizations/${orgId}/student/courses/${cid}`, {
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
          setError('Could not load course details. Please try again.');
        }
        return;
      }
      const body = await res.json();
      setCourse(body.data ?? null);
    } catch {
      setError('Could not reach the server. Please try again.');
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto flex max-w-5xl items-center gap-3 text-neutral-700">
          <Spinner size="lg" label="Loading course..." />
          <span>Loading course...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <Link href="/dashboard/student" className="text-sm text-primary-600 hover:text-primary-700">
            &larr; My Courses
          </Link>
        </div>

        {error ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState
              title="Unable to load course"
              message={error}
              action={organizationId && courseId ? { label: 'Retry', onClick: () => loadCourse(organizationId, courseId) } : undefined}
            />
          </div>
        ) : course ? (
          <>
            <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {course.category && <Badge variant="primary" size="sm">{course.category}</Badge>}
                {course.difficulty && <Badge variant="default" size="sm">{course.difficulty}</Badge>}
                <Badge variant="success" size="sm">Enrolled</Badge>
              </div>
              <h1 className="text-3xl font-bold text-neutral-900">{course.title}</h1>
              {course.description && (
                <p className="mt-3 text-neutral-600">{course.description}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-4 text-sm text-neutral-500">
                  {course.estimatedMinutes && (
                    <span>Estimated time: {Math.round(course.estimatedMinutes / 60)}h {course.estimatedMinutes % 60}m</span>
                  )}
                  <span>{course.modules.length} module{course.modules.length !== 1 ? 's' : ''}</span>
                  <span>
                    {course.modules.reduce((sum, m) => sum + m.lessonCount, 0)} lesson{course.modules.reduce((sum, m) => sum + m.lessonCount, 0) !== 1 ? 's' : ''}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { window.location.href = `/dashboard/student/courses/${courseId}/progress`; }}
                >
                  View Progress
                </Button>
              </div>
              {course.learningObjectives.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-2">What you&apos;ll learn</h3>
                  <ul className="space-y-1">
                    {course.learningObjectives.map((obj, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                        <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {obj}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <h2 className="mb-4 text-lg font-semibold text-neutral-900">Course Content</h2>
            {course.modules.length === 0 ? (
              <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <EmptyState
                  icon={EmptyStateIcons.NoData}
                  title="No modules yet"
                  description="The instructor hasn't added any modules to this course yet."
                />
              </div>
            ) : (
              <div className="space-y-3">
                {course.modules.map((module, index) => (
                  <Link
                    key={module.id}
                    href={`/dashboard/student/courses/${courseId}/modules/${module.id}`}
                  >
                    <div className="group flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-all hover:border-primary-200 hover:shadow-md cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-sm font-bold text-primary-700">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">
                            {module.title}
                          </h3>
                          {module.description && (
                            <p className="mt-0.5 text-sm text-neutral-500 line-clamp-1">{module.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-neutral-500">
                        <span>{module.lessonCount} lesson{module.lessonCount !== 1 ? 's' : ''}</span>
                        <svg className="h-5 w-5 text-neutral-400 group-hover:text-primary-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
