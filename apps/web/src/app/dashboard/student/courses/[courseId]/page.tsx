'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  Spinner,
} from '@/components/ui';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { useProgress } from '@/features/student/useProgress';

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
  const router = useRouter();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const { data: progress } = useProgress(organizationId ?? '', courseId ?? '');

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

  // Load course data once organizationId and courseId are set
  useEffect(() => {
    if (!organizationId || !courseId) {
      setLoading(false);
      return;
    }
    let active = true;

    async function loadCourse() {
      setLoading(true);
      try {
        const apiBase = '';
        const res = await fetch(`${apiBase}/api/v1/organizations/${organizationId}/student/courses/${courseId}`, {
          credentials: 'include',
        });
        if (!active) return;
        if (!res.ok) {
          let code: unknown = null;
          try {
            code = (await res.json())?.error;
          } catch {
            code = null;
          }
          if (code === 'STUDENT_NOT_ENROLLED') {
            // Student is not enrolled - redirect to overview to show enrollment/purchase flow
            setError(null);
            router.replace(`/dashboard/student/courses/${courseId}/overview`);
            return;
          } else if (code === 'COURSE_NOT_FOUND') {
            setError('Course not found.');
          } else {
            setError('Could not load course details. Please try again.');
          }
          setLoading(false);
          return;
        }
        const body = await res.json();
        if (!active) return;
        const loadedCourse = body.data as CourseDetail | null;
        setCourse(loadedCourse);
        setExpandedModuleId(loadedCourse?.modules[0]?.id ?? null);
        setLoading(false);
      } catch {
        if (active) {
          setError('Could not reach the server. Please try again.');
          setLoading(false);
        }
      }
    }

    loadCourse();
    return () => {
      active = false;
    };
  }, [organizationId, courseId, router]);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-5xl items-center gap-3 text-neutral-700">
        <Spinner size="lg" label="Loading course..." />
        <span>Loading course...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
        {error ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState
              title="Unable to load course"
              message={error}
              action={
                organizationId && courseId
                  ? {
                      label: 'Retry',
                      onClick: () => {
                        setError(null);
                        setLoading(true);
                      },
                    }
                  : undefined
              }
            />
          </div>
        ) : course ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-neutral-900">Course Content</h2>
              <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-semibold text-primary-700">
                {course.modules.length} module{course.modules.length !== 1 ? 's' : ''} total
              </span>
            </div>
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
                {course.modules.map((module, index) => {
                  const isFirstModule = index === 0;
                  const isExpanded = expandedModuleId === module.id;
                  const moduleProgress = progress?.modules.find((item) => item.id === module.id);
                  const isComplete = moduleProgress?.complete === true;
                  return (
                  <div
                    key={module.id}
                    className={`rounded-2xl border bg-white shadow-sm transition-all ${
                      isExpanded ? 'border-primary-200 ring-1 ring-primary-100' : 'border-neutral-200'
                    }`}
                  >
                    <Link href={`/dashboard/student/courses/${courseId}/modules/${module.id}`}>
                    <div className="group flex cursor-pointer items-center justify-between p-5 transition-all hover:bg-primary-50/30">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${isExpanded ? 'bg-primary-100 text-primary-800' : 'bg-primary-50 text-primary-700'}`}>
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">
                              {module.title}
                            </h3>
                            {isComplete && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#e9f7ef] px-2.5 py-1 text-xs font-semibold text-[#16834b]">
                                <span aria-hidden="true">✓</span>
                                Module Complete
                              </span>
                            )}
                          </div>
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
                    {isExpanded && (
                      <div className="border-t border-primary-100 bg-primary-50/30 px-5 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm text-neutral-600">
                            {isComplete ? 'Congratulations! You completed this module.' : isFirstModule ? 'Start with this first module.' : 'Continue this module.'}
                            {' '}{module.lessonCount} lesson{module.lessonCount !== 1 ? 's' : ''} available.
                          </p>
                          <Link
                            href={`/dashboard/student/courses/${courseId}/modules/${module.id}`}
                            className="inline-flex items-center rounded-lg bg-[#5A321F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#472719]"
                          >
                            Open Module
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </>
        ) : null}
      </div>
  );
}
