'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  Button,
  ErrorState,
  Input,
  PageLoader,
  Spinner,
} from '@/components/ui';
import { useToast } from '@/components/ui/ToastProvider';
import { useEnroll } from '@/features/student/useEnrollment';
import {
  type PaymentMethod,
  useCheckoutOrder,
  useSubmitManualPayment,
} from '@/features/student/useCourseStore';
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
  const searchParams = useSearchParams();
  const toast = useToast();
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [course, setCourse] = useState<CourseOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('COD');
  const [transactionId, setTransactionId] = useState('');
  const [manualPaymentError, setManualPaymentError] = useState('');
  const [manualPaymentSubmitted, setManualPaymentSubmitted] = useState(false);
  const [order, setOrder] = useState<{
    id: string;
    status: string;
    totalAmount: number;
    paymentMethod: PaymentMethod;
  } | null>(null);

  // Use mutation hooks for enrollment operations
  const enrollMutation = useEnroll(organizationId || '', courseId || '');
  const checkoutMutation = useCheckoutOrder(organizationId || '', courseId || '', selectedPaymentMethod);
  const submitManualPayment = useSubmitManualPayment(organizationId || '', order?.id ?? null);

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
    if (searchParams.get('checkout') === '1') setShowCheckout(true);
  }, [user, userLoading, courseId, searchParams]);

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

  function handlePurchase() {
    if (!organizationId || !courseId) return;
    setOrder(null);
    setTransactionId('');
    setManualPaymentError('');
    setManualPaymentSubmitted(false);
    setShowCheckout(true);
  }

  function handleCheckout() {
    checkoutMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data) {
          setOrder({
            id: data.id,
            status: data.status,
            totalAmount: data.totalAmount,
            paymentMethod: selectedPaymentMethod,
          });
        }
      },
      onError: (error) => {
        const code = error instanceof Error ? error.message : null;
        toast.error(getPurchaseErrorMessage(code));
      },
    });
  }

  function handleManualSubmit() {
    const normalized = transactionId.trim();
    if (selectedPaymentMethod === 'BANK_TRANSFER' && !normalized) {
      setManualPaymentError('Transaction ID is required before submitting a bank transfer payment.');
      return;
    }

    setManualPaymentError('');
    submitManualPayment.mutate(
      {
        paymentMethod: selectedPaymentMethod === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'COD',
        transactionId: normalized || undefined,
      },
      {
        onSuccess: () => {
          setManualPaymentSubmitted(true);
          toast.success('Payment submitted. The course owner must verify it before access is unlocked.');
        },
        onError: () => {
          toast.error('We could not submit your payment. Please try again.');
        },
      },
    );
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
    return <PageLoader label="Loading course..." />;
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
            if (!checkoutMutation.isPending && !submitManualPayment.isPending) setShowCheckout(false);
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
                disabled={checkoutMutation.isPending || submitManualPayment.isPending}
                onClick={() => setShowCheckout(false)}
              >
                x
              </button>
            </div>
            <div className="space-y-4 p-6">
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

              {!order ? (
                <>
                  <div className="space-y-3">
                    {(['COD', 'BANK_TRANSFER'] as PaymentMethod[]).map((method) => {
                      const selected = selectedPaymentMethod === method;
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setSelectedPaymentMethod(method)}
                          className={`flex w-full items-start justify-between gap-4 rounded-xl border p-4 text-left ${
                            selected ? 'border-primary-600 bg-primary-50' : 'border-neutral-200 bg-white hover:border-neutral-300'
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-neutral-900">
                              {method === 'COD' ? 'Cash on Delivery' : 'Bank Transfer'}
                            </p>
                            <p className="mt-1 text-sm text-neutral-600">
                              {method === 'COD'
                                ? 'Pay on delivery and wait for owner confirmation.'
                                : 'Transfer to the course owner and submit the transaction ID.'}
                            </p>
                          </div>
                          <span className={`mt-1 h-5 w-5 rounded-full border-2 ${
                            selected ? 'border-primary-600 bg-primary-600' : 'border-neutral-300 bg-white'
                          }`} />
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button
                      variant="ghost"
                      onClick={() => setShowCheckout(false)}
                      disabled={checkoutMutation.isPending}
                      className="border border-[#ead8c6] bg-[#fffaf5] text-[#7a4a2e] hover:bg-[#f5ebdd]"
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCheckout} loading={checkoutMutation.isPending} loadingText="Creating order...">
                      Continue with {selectedPaymentMethod === 'COD' ? 'COD' : 'Bank Transfer'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-warning-200 bg-warning-50 p-4 text-sm text-warning-800">
                    <p className="font-semibold">Payment pending review</p>
                    <p className="mt-1">
                      {selectedPaymentMethod === 'COD'
                        ? 'Your COD order is waiting for the course owner to confirm it.'
                        : 'Submit your transaction ID so the course owner can verify your bank transfer.'}
                    </p>
                  </div>
                  {selectedPaymentMethod === 'BANK_TRANSFER' && !manualPaymentSubmitted && (
                    <Input
                      label="Transaction ID"
                      value={transactionId}
                      onChange={(event) => setTransactionId(event.target.value)}
                      placeholder="e.g. TXN-123456"
                      error={manualPaymentError}
                    />
                  )}
                  {manualPaymentSubmitted && (
                    <div className="rounded-xl border border-success-200 bg-success-50 p-4 text-sm text-success-700">
                      Payment submitted successfully. Access will be granted after approval.
                    </div>
                  )}
                  <div className="flex justify-end gap-3 pt-2">
                    <Button
                      variant="ghost"
                      onClick={() => setShowCheckout(false)}
                      disabled={submitManualPayment.isPending}
                      className="border border-[#ead8c6] bg-[#fffaf5] text-[#7a4a2e] hover:bg-[#f5ebdd]"
                    >
                      Close
                    </Button>
                    {selectedPaymentMethod === 'BANK_TRANSFER' && !manualPaymentSubmitted && (
                      <Button onClick={handleManualSubmit} loading={submitManualPayment.isPending} loadingText="Submitting...">
                        Submit payment details
                      </Button>
                    )}
                    {selectedPaymentMethod === 'COD' && !manualPaymentSubmitted && (
                      <Button onClick={handleManualSubmit} loading={submitManualPayment.isPending} loadingText="Submitting...">
                        Confirm COD
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}