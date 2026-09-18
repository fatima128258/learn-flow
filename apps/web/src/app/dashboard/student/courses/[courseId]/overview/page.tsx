'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  Button,
  DashboardSkeleton,
  ErrorState,
  Spinner,
} from '@/components/ui';
import { useToast } from '@/components/ui/ToastProvider';
import { useEnroll } from '@/features/student/useEnrollment';
import { useCheckoutOrder, usePayOrder } from '@/features/student/useCourseStore';
import { getPurchaseErrorMessage } from '@/features/student/courseErrors';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { getCoursePricing } from '@/lib/coursePricing';
import { currency } from '@/lib/types';

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
  const [showCheckout, setShowCheckout] = useState(false);
  const [order, setOrder] = useState<{ id: string; status: string; totalAmount: number } | null>(null);
  const [paymentFailed, setPaymentFailed] = useState(false);

  // Use mutation hooks for enrollment operations
  const enrollMutation = useEnroll(organizationId || '', courseId || '');
  const checkoutMutation = useCheckoutOrder(organizationId || '', courseId || '');
  const paymentMutation = usePayOrder(organizationId || '', courseId || '', order?.id ?? null);

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
    setPaymentFailed(false);
    setOrder(null);
    setShowCheckout(true);
  }

  function handleCheckout() {
    checkoutMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data) setOrder({ id: data.id, status: data.status, totalAmount: data.totalAmount });
      },
      onError: (error) => {
        const code = error instanceof Error ? error.message : null;
        toast.error(getPurchaseErrorMessage(code));
      },
    });
  }

  function handlePayment() {
    paymentMutation.mutate(undefined, {
      onSuccess: () => {
        setPaymentFailed(false);
        setShowCheckout(false);
        setCourse((previous) => previous ? { ...previous, isEnrolled: true } : previous);
        toast.success('Payment successful. Your course is unlocked.');
      },
      onError: (error) => {
        setPaymentFailed(true);
        const code = error instanceof Error ? error.message : null;
        toast.error(getPurchaseErrorMessage(code));
      },
    });
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
      <DashboardSkeleton cards={3} />
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
              <h1 className="text-3xl font-semibold text-neutral-900">Playlist: {course.title}</h1>

              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-900">Description</h2>
                <p className="mt-2 text-neutral-900">{course.description || 'No description available.'}</p>
              </div>

              {course.instructor?.name && (
                <div className="mt-6">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-900">Instructor</h2>
                  <p className="mt-2 text-neutral-900">{course.instructor.name}</p>
                </div>
              )}

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
      {showCheckout && course && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-title"
          onClick={() => {
            if (!checkoutMutation.isPending && !paymentMutation.isPending) setShowCheckout(false);
          }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-neutral-200 p-6">
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Checkout</p>
                <h2 id="checkout-title" className="mt-1 text-2xl font-semibold text-neutral-900">Complete your enrollment</h2>
              </div>
              <button
                type="button"
                aria-label="Close checkout"
                className="text-2xl text-neutral-400 hover:text-neutral-700"
                disabled={checkoutMutation.isPending || paymentMutation.isPending}
                onClick={() => setShowCheckout(false)}
              >
                x
              </button>
            </div>
            <div className="space-y-4 p-6">
              {paymentFailed && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <p className="font-semibold">Payment Failed</p>
                  <p className="mt-1">Your course has not been unlocked. You can try again.</p>
                </div>
              )}
              <div className="space-y-3">
                <div className="flex justify-between gap-4"><span className="text-neutral-600">Course</span><span className="text-right font-medium text-neutral-900">{course.title}</span></div>
                {course.instructor?.name && (
                  <div className="flex justify-between gap-4">
                    <span className="text-neutral-600">Instructor</span>
                    <span className="text-right font-medium text-neutral-900">{course.instructor.name}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-neutral-200 pt-3"><span className="font-semibold text-neutral-900">Total</span><span className="text-xl font-bold text-neutral-900">{currency(order?.totalAmount ?? getCoursePricing(course.price, course.discountPrice).currentPrice ?? 0)}</span></div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowCheckout(false)}
                  disabled={checkoutMutation.isPending || paymentMutation.isPending}
                  className="border border-[#ead8c6] bg-[#fffaf5] text-[#7a4a2e] hover:bg-[#f5ebdd]"
                >
                  Cancel
                </Button>
                {!order ? (
                  <Button onClick={handleCheckout} loading={checkoutMutation.isPending} loadingText="Preparing checkout...">
                    Continue to checkout
                  </Button>
                ) : (
                  <Button onClick={handlePayment} loading={paymentMutation.isPending} loadingText="Processing payment...">
                    Pay {currency(order.totalAmount)}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}