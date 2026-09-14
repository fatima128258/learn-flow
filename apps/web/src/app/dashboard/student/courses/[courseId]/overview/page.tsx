'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Button,
  ErrorState,
  Spinner,
} from '@/components/ui';
import { useToast } from '@/components/ui/ToastProvider';
import { useEnroll, usePurchase } from '@/features/student/useEnrollment';
import { getPurchaseErrorMessage } from '@/features/student/courseErrors';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { getCoursePricing } from '@/lib/coursePricing';

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

function PriceDisplay({ price, discountPrice }: { price: number | null; discountPrice: number | null }) {
  const { originalPrice, currentPrice, hasDiscount } = getCoursePricing(price, discountPrice);
  return (
    <span className="flex items-center gap-3">
      <span className="text-2xl font-bold text-neutral-900">{formatPrice(currentPrice)}</span>
      {hasDiscount && (
        <span className="text-lg text-neutral-500 line-through">{formatPrice(originalPrice)}</span>
      )}
    </span>
  );
}

export default function StudentCourseOverviewPage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const router = useRouter();
  const toast = useToast();
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [course, setCourse] = useState<CourseOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Use mutation hooks for enrollment operations
  const enrollMutation = useEnroll(organizationId || '', courseId || '');
  const purchaseMutation = usePurchase(organizationId || '', courseId || '');

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
    if (courseId) loadCourse(orgId, courseId);
  }, [user, userLoading, courseId]);

  async function loadCourse(orgId: string, cid: string) {
    setLoading(true);
    try {
      const apiBase = '';
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
        setLoading(false);
        return;
      }
      const body = await res.json();
      setCourse(body.data ?? null);
      setLoading(false);
    } catch {
      setError('Could not reach the server. Please try again.');
      setLoading(false);
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
          <div className="mb-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-6">
              <h1 className="text-3xl font-bold text-neutral-900">Playlist: {course.title}</h1>

              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-900">Description</h2>
                <p className="mt-2 text-neutral-900">{course.description || 'No description available.'}</p>
              </div>

              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-900">Instructor</h2>
                <p className="mt-2 text-neutral-900">{course.instructor?.name || 'Instructor unavailable'}</p>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-900">Category</h2>
                  <p className="mt-2 text-neutral-900">{course.category || 'Not specified'}</p>
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-900">Difficulty Level</h2>
                  <p className="mt-2 text-neutral-900">{course.difficulty || 'Not specified'}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">Price</p>
                  <PriceDisplay price={course.price} discountPrice={course.discountPrice} />
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
                    Buy Now - {formatPrice(getCoursePricing(course.price, course.discountPrice).currentPrice)}
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

        </>
      ) : null}
    </div>
  );
}