'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { useToast } from '@/components/ui/ToastProvider';
import { useEnroll, usePurchase } from '@/features/student/useEnrollment';
import { getPurchaseErrorMessage } from '@/features/student/courseErrors';

type MeResponse = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string;
    role?: string | null;
    organizationId?: string | null;
  };
};

type CourseOverview = {
  id: string;
  organizationId: string;
  instructor: { id: string; name: string | null };
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  category: string | null;
  difficulty: string | null;
  price: number | null;
  discountPrice: number | null;
  estimatedMinutes: number | null;
  learningObjectives: string[];
  status: string;
  publishedAt: string | null;
  moduleCount: number;
  lessonCount: number;
  quizCount: number;
  isEnrolled: boolean;
};

function formatPrice(value: number | null): string {
  if (value === null || value === undefined) return 'Free';
  if (value === 0) return 'Free';
  return `$${Number(value).toFixed(2)}`;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'Self-paced';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function StudentCourseOverviewPage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const router = useRouter();
  const toast = useToast();

  const [course, setCourse] = useState<CourseOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Use mutation hooks for enrollment operations
  const enrollMutation = useEnroll(organizationId || '', courseId || '');
  const purchaseMutation = usePurchase(organizationId || '', courseId || '');

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
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${orgId}/student/courses/${cid}/overview`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        let code: unknown = null;
        try {
          code = (await res.json())?.error;
        } catch {
          code = null;
        }
        if (code === 'COURSE_NOT_FOUND') {
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

  async function handlePurchase() {
    if (!organizationId || !courseId) return;
    
    try {
      await purchaseMutation.mutateAsync();
      toast.success('Successfully enrolled in the course!');
      
      // Update local course state immediately
      setCourse(prev => prev ? { ...prev, isEnrolled: true } : null);
      
      router.push(`/dashboard/student/courses/${courseId}`);
    } catch (error: unknown) {
      const errorCode = error instanceof Error ? error.message : null;
      toast.error(getPurchaseErrorMessage(errorCode));
    }
  }

  async function handleEnroll() {
    if (!organizationId || !courseId) return;
    
    try {
      await enrollMutation.mutateAsync();
      toast.success('Successfully enrolled in the course!');
      
      // Update local course state immediately
      setCourse(prev => prev ? { ...prev, isEnrolled: true } : null);
      
      router.push(`/dashboard/student/courses/${courseId}`);
    } catch (error: unknown) {
      const errorCode = error instanceof Error ? error.message : null;
      toast.error(getPurchaseErrorMessage(errorCode));
    }
  }

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
      <PageHeader
        subtitle="Course Catalog"
        title={course?.title ?? 'Course Details'}
        breadcrumbs={
          <div className="flex items-center gap-2 text-sm">
            <Link href="/dashboard/student/search" className="text-primary-600 hover:text-primary-700">
              Search Courses
            </Link>
            <span className="text-neutral-400">/</span>
            <span className="text-neutral-600">{course?.title ?? 'Loading...'}</span>
          </div>
        }
      />

      {error ? (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <ErrorState
            title="Unable to load course"
            message={error}
            action={
              organizationId && courseId
                ? { label: 'Retry', onClick: () => loadCourse(organizationId, courseId) }
                : undefined
            }
          />
        </div>
      ) : course ? (
        <>
          {/* Course Header */}
          <div className="mb-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {course.category && <Badge variant="primary" size="sm">{course.category}</Badge>}
                {course.difficulty && <Badge variant="default" size="sm">{course.difficulty}</Badge>}
                <Badge
                  variant={course.isEnrolled ? 'success' : 'info'}
                  size="sm"
                >
                  {course.isEnrolled ? 'Enrolled' : 'Available'}
                </Badge>
              </div>

              <h1 className="text-3xl font-bold text-neutral-900">{course.title}</h1>

              {course.instructor?.name && (
                <p className="mt-2 text-sm text-neutral-600">
                  Instructor: <span className="font-medium">{course.instructor.name}</span>
                </p>
              )}

              {course.description && (
                <p className="mt-4 text-neutral-700">{course.description}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-neutral-500">
                <span>{formatDuration(course.estimatedMinutes)}</span>
                <span>•</span>
                <span>{course.moduleCount} module{course.moduleCount !== 1 ? 's' : ''}</span>
                <span>•</span>
                <span>{course.lessonCount} lesson{course.lessonCount !== 1 ? 's' : ''}</span>
                <span>•</span>
                <span>{course.quizCount} quiz{course.quizCount !== 1 ? 'zes' : ''}</span>
              </div>

              {course.learningObjectives.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-2">What you&apos;ll learn</h3>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {course.learningObjectives.slice(0, 6).map((obj, i) => (
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

            {/* Enrollment/Purchase Card */}
            <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-neutral-900">
                    {formatPrice(course.price)}
                  </span>
                  {course.discountPrice && course.price && course.discountPrice < course.price && (
                    <span className="text-lg text-neutral-500 line-through">
                      {formatPrice(course.price)}
                    </span>
                  )}
                </div>

                {course.isEnrolled ? (
                  <Button
                    size="lg"
                    onClick={() => router.push(`/dashboard/student/courses/${courseId}`)}
                  >
                    Continue Learning
                  </Button>
                ) : course.price !== null && course.price > 0 ? (
                  <Button
                    size="lg"
                    onClick={handlePurchase}
                    loading={purchaseMutation.isPending}
                    loadingText="Processing..."
                  >
                    Buy Now - {formatPrice(course.discountPrice ?? course.price)}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={handleEnroll}
                    loading={enrollMutation.isPending}
                    loadingText="Enrolling..."
                  >
                    Enroll for Free
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Course Content Preview */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Course Content</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {course.moduleCount} modules • {course.lessonCount} lessons • {course.quizCount} quizzes
            </p>

            <div className="mt-6 space-y-4">
              {course.moduleCount === 0 ? (
                <EmptyState
                  icon={EmptyStateIcons.NoData}
                  title="No content yet"
                  description="The instructor hasn't added any modules to this course yet."
                />
              ) : (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-center text-sm text-neutral-600">
                  <p>Course content will be visible after enrollment.</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {course.moduleCount} modules, {course.lessonCount} lessons, {course.quizCount} quizzes available.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}