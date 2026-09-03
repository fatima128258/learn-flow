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

type LessonItem = {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  duration: number | null;
  order: number;
  isPreview: boolean;
};

type ModuleLessonsResponse = {
  moduleId: string;
  moduleTitle: string;
  courseId: string;
  courseName: string;
  lessons: LessonItem[];
};

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

export default function StudentModuleLessonsPage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const moduleId = typeof params.moduleId === 'string' ? params.moduleId : null;
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [data, setData] = useState<ModuleLessonsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

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
    if (courseId && moduleId) loadLessons(orgId, courseId, moduleId);
  }, [user, userLoading, courseId, moduleId]);

  async function loadLessons(orgId: string, cid: string, mid: string) {
    try {
      const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${orgId}/student/courses/${cid}/modules/${mid}/lessons`,
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
        } else if (code === 'MODULE_NOT_FOUND') {
          setError('Module not found.');
        } else {
          setError('Could not load lessons. Please try again.');
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
      <div className="mx-auto flex max-w-5xl items-center gap-3 text-neutral-700">
        <Spinner size="lg" label="Loading lessons..." />
        <span>Loading lessons...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        subtitle="Student"
        title="Module Lessons"
          breadcrumbs={
            <div className="flex items-center gap-2 text-sm">
              <Link href="/dashboard/student" className="text-primary-600 hover:text-primary-700">My Courses</Link>
              <span className="text-neutral-400">/</span>
              {data && (
                <>
                  <Link href={`/dashboard/student/courses/${courseId}`} className="text-primary-600 hover:text-primary-700">
                    {data.courseName}
                  </Link>
                  <span className="text-neutral-400">/</span>
                </>
              )}
              <span className="text-neutral-600">{data?.moduleTitle ?? 'Module'}</span>
            </div>
          }
        />

        {error ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState
              title="Unable to load lessons"
              message={error}
              action={organizationId && courseId && moduleId ? { label: 'Retry', onClick: () => loadLessons(organizationId, courseId!, moduleId!) } : undefined}
            />
          </div>
        ) : data ? (
          <>
            <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h1 className="text-2xl font-bold text-neutral-900">{data.moduleTitle}</h1>
              <p className="mt-1 text-sm text-neutral-500">
                {data.lessons.length} lesson{data.lessons.length !== 1 ? 's' : ''} in this module
              </p>
            </div>

            {data.lessons.length === 0 ? (
              <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <EmptyState
                  icon={EmptyStateIcons.NoData}
                  title="No lessons yet"
                  description="The instructor hasn't added any lessons to this module yet."
                />
              </div>
            ) : (
              <div className="space-y-2">
                {data.lessons.map((lesson, index) => (
                  <Link
                    key={lesson.id}
                    href={`/dashboard/student/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`}
                  >
                    <div className="group flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:border-primary-200 hover:shadow-md cursor-pointer">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-neutral-600 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                        {lessonTypeIcon(lesson.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-neutral-400">{index + 1}.</span>
                          <h3 className="font-medium text-neutral-900 group-hover:text-primary-600 transition-colors truncate">
                            {lesson.title}
                          </h3>
                          {lesson.isPreview && (
                            <Badge variant="info" size="sm">Preview</Badge>
                          )}
                        </div>
                        {lesson.description && (
                          <p className="mt-0.5 text-sm text-neutral-500 line-clamp-1">{lesson.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-neutral-500 flex-shrink-0">
                        {lesson.type && (
                          <Badge variant="default" size="sm">{lesson.type}</Badge>
                        )}
                        {lesson.duration != null && (
                          <span>{lesson.duration}m</span>
                        )}
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
  );
}
