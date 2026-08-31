'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { useCourseOverview, usePurchaseCourse } from '@/features/student/useCourseStore';
import { getPurchaseErrorMessage } from '@/features/student/courseErrors';
import { currency } from '@/lib/types';
import { Badge, Button, Card, CardSkeleton, EmptyState, LinkButton, Skeleton } from '@/components/ui';
import { Footer } from '@/components/layout/Footer';
import { useToast } from '@/components/ui/ToastProvider';
import { ApiError } from '@/lib/api';

export default function CheckoutPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;

  const toast = useToast();

  const { data: user, isLoading: userLoading } = useCurrentUser();
  const organizationId = user?.organizationId ?? '';
  const { data: course, isLoading: courseLoading } = useCourseOverview(organizationId, courseId);

  const purchase = usePurchaseCourse(organizationId, courseId);
  const [order, setOrder] = useState<{ id: string; status: string; totalAmount: number } | null>(null);

  function handlePurchase() {
    purchase.mutate(undefined, {
      onSuccess: (data) => {
        if (data) {
          setOrder({ id: data.id, status: data.status, totalAmount: data.totalAmount });
          toast.success('Purchase completed successfully.');
        }
      },
      onError: (err) => {
        const code = err instanceof ApiError ? err.code : null;
        toast.error(getPurchaseErrorMessage(code));
      },
    });
  }

  if (userLoading || courseLoading) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto max-w-2xl">
          <Skeleton variant="text" height={28} width={240} className="mb-4" />
          <CardSkeleton />
        </div>
      </main>
    );
  }

  if (!user || user.role !== 'STUDENT' || !organizationId || !course) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto max-w-2xl">
          <Card>
            <EmptyState
              title="Checkout unavailable"
              description="Please log in as a student and choose a published course to continue."
              action={{ label: 'Back to catalog', onClick: () => { window.location.href = '/dashboard/student/search'; } }}
            />
          </Card>
        </div>
      </main>
    );
  }

  const hasDiscount = course.discountPrice !== null && course.discountPrice < course.price;
  const finalAmount = hasDiscount ? (course.discountPrice ?? course.price) : course.price;

  if (order) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto max-w-2xl">
          <Card>
            <div className="flex flex-col items-center py-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success-100 text-success-600">
                <svg className="h-8 w-8" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-neutral-900">Payment successful</h1>
              <p className="mt-2 max-w-md text-sm text-neutral-600">
                You have purchased <span className="font-semibold text-neutral-900">{course.title}</span>.
                Your course is now ready in your dashboard.
              </p>
              <dl className="mt-6 w-full max-w-sm space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Order</dt>
                  <dd className="font-medium text-neutral-900">{order.id}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Status</dt>
                  <dd><Badge variant="success" size="sm">{order.status}</Badge></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Total</dt>
                  <dd className="font-bold text-neutral-900">{currency(order.totalAmount)}</dd>
                </div>
              </dl>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <LinkButton href={`/dashboard/student/courses/${course.id}`}>Start learning</LinkButton>
                <LinkButton href="/dashboard/student" variant="outline">Back to my courses</LinkButton>
              </div>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-2xl">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm">
          <ol className="flex items-center gap-2">
            <li>
              <Link href={`/courses/${courseId}`} className="text-primary-600 hover:text-primary-700">
                {course.title}
              </Link>
            </li>
            <li aria-hidden="true" className="text-neutral-400">/</li>
            <li className="text-neutral-600">Checkout</li>
          </ol>
        </nav>

        {course.isEnrolled ? (
          <Card>
            <EmptyState
              title="You are already enrolled"
              description="You already have access to this course. Continue straight to learning."
              action={{ label: 'Continue learning', onClick: () => { window.location.href = `/dashboard/student/courses/${course.id}`; } }}
            />
          </Card>
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="border-b border-neutral-200 p-6">
              <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Checkout</p>
              <h1 className="mt-1 text-2xl font-bold text-neutral-900">Complete your enrollment</h1>
            </div>

            <div className="p-6">
              <dl className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-neutral-600">Course</dt>
                  <dd className="text-right font-medium text-neutral-900">{course.title}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-neutral-600">Instructor</dt>
                  <dd className="text-right font-medium text-neutral-900">{course.instructor.name ?? course.instructor.email}</dd>
                </div>
                {course.category && (
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-neutral-600">Category</dt>
                    <dd className="text-right font-medium text-neutral-900">{course.category.name}</dd>
                  </div>
                )}
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-neutral-600">Contents</dt>
                  <dd className="text-right font-medium text-neutral-900">
                    {course.moduleCount} modules, {course.lessonCount} lessons, {course.quizCount} quizzes
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-t border-neutral-200 pt-3">
                  <dt className="text-neutral-600">Price</dt>
                  <dd className="text-right font-medium text-neutral-900">{currency(course.price)}</dd>
                </div>
                {hasDiscount && (
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-neutral-600">Discount</dt>
                    <dd className="text-right font-semibold text-success-700">
                      −{currency(course.price - (course.discountPrice ?? course.price))}
                    </dd>
                  </div>
                )}
                <div className="flex items-start justify-between gap-4 border-t border-neutral-200 pt-3">
                  <dt className="text-lg font-semibold text-neutral-900">Total</dt>
                  <dd className="text-right text-2xl font-bold text-neutral-900">{currency(finalAmount)}</dd>
                </div>
              </dl>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
                <Button
                  size="lg"
                  loading={purchase.isPending}
                  onClick={handlePurchase}
                  disabled={purchase.isPending}
                >
                  {purchase.isPending ? 'Processing payment...' : `Pay ${currency(finalAmount)}`}
                </Button>
                <LinkButton href={`/courses/${courseId}`} variant="outline" size="lg">
                  Cancel
                </LinkButton>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6">
          <Footer />
        </div>
      </div>
    </main>
  );
}