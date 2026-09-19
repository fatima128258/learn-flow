'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { type PaymentMethod, useCheckoutOrder, useCompleteStripePayment, useCourseOverview, usePayOrder, useSubmitManualPayment } from '@/features/student/useCourseStore';
import { getPurchaseErrorMessage } from '@/features/student/courseErrors';
import { currency } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Input, LinkButton, PageLoading } from '@/components/ui';
import { Footer } from '@/components/layout/Footer';
import { useToast } from '@/components/ui/ToastProvider';
import { ApiError } from '@/lib/api';
import { getCoursePricing } from '@/lib/coursePricing';

const paymentMethodMeta: Record<PaymentMethod, { label: string; description: string }> = {
  MOCK: { label: 'Mock payment', description: 'Legacy checkout flow.' },
  COD: { label: 'Cash on Delivery', description: 'Pay on delivery and wait for owner confirmation.' },
  BANK_TRANSFER: { label: 'Bank Transfer', description: 'Transfer to the course owner and share the transaction ID.' },
  STRIPE: { label: 'Stripe', description: 'Pay securely with Stripe Checkout in test mode.' },
};

export default function CheckoutPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;
  const searchParams = useSearchParams();

  const toast = useToast();

  const { data: user, isLoading: userLoading } = useCurrentUser();
  const organizationId = user?.organizationId ?? '';
  const { data: course, isLoading: courseLoading } = useCourseOverview(organizationId, courseId);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('COD');
  const [transactionId, setTransactionId] = useState('');
  const [manualPaymentError, setManualPaymentError] = useState('');
  const [manualPaymentSubmitted, setManualPaymentSubmitted] = useState(false);
  const [order, setOrder] = useState<{ id: string; status: string; totalAmount: number; paymentMethod?: PaymentMethod } | null>(null);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [stripeVerifying, setStripeVerifying] = useState(false);
  const processedStripeSessionRef = useRef<string | null>(null);

  const checkout = useCheckoutOrder(organizationId, courseId, selectedPaymentMethod);
  const payment = usePayOrder(organizationId, courseId, order?.id ?? null);
  const submitManualPayment = useSubmitManualPayment(organizationId, order?.id ?? null);
  const completeStripePayment = useCompleteStripePayment(organizationId, courseId);

  useEffect(() => {
    const sessionId = searchParams.get('stripe_session_id');
    if (!sessionId || !organizationId || !courseId || !user || processedStripeSessionRef.current === sessionId) return;
    processedStripeSessionRef.current = sessionId;
    setStripeVerifying(true);
    completeStripePayment.mutate(sessionId, {
      onSuccess: (data) => {
        if (data) {
          setOrder({
            id: data.orderId,
            status: data.orderStatus,
            totalAmount: data.totalAmount,
            paymentMethod: 'STRIPE',
          });
          toast.success('Payment successful. Your course is unlocked.');
        }
        window.history.replaceState({}, '', `/checkout/${courseId}`);
      },
      onError: (err) => {
        processedStripeSessionRef.current = null;
        toast.error(err instanceof ApiError && err.code === 'STRIPE_SESSION_INVALID'
          ? 'Stripe payment could not be verified.'
          : 'We could not complete your Stripe payment.');
      },
      onSettled: () => setStripeVerifying(false),
    });
  }, [completeStripePayment, courseId, organizationId, searchParams, toast, user]);

  useEffect(() => {
    if (searchParams.get('stripe_cancelled') !== '1') return;
    toast.info('Stripe checkout was cancelled. No payment was completed.');
    window.history.replaceState({}, '', `/checkout/${courseId}`);
  }, [courseId, searchParams, toast]);

  function handleCheckout() {
    checkout.mutate(undefined, {
      onSuccess: (data) => {
        if (data) {
          setOrder({ id: data.id, status: data.status, totalAmount: data.totalAmount, paymentMethod: selectedPaymentMethod });
          setPaymentFailed(false);
          setManualPaymentSubmitted(false);
          setTransactionId('');
          setManualPaymentError('');
          if (selectedPaymentMethod === 'STRIPE') {
            if (!data.stripeCheckoutUrl) {
              toast.error('Stripe checkout is currently unavailable.');
              return;
            }
            window.location.assign(data.stripeCheckoutUrl);
            return;
          }
          if (selectedPaymentMethod === 'MOCK') {
            toast.info('Order created. Complete the mock payment to unlock this course.');
          }
        }
      },
      onError: (err) => {
        const code = err instanceof ApiError ? err.code : null;
        toast.error(getPurchaseErrorMessage(code));
      },
    });
  }

  function handlePayment() {
    payment.mutate(undefined, {
      onSuccess: (data) => {
        if (data) {
          setPaymentFailed(false);
          setOrder({ id: data.id, status: data.status, totalAmount: data.totalAmount, paymentMethod: 'MOCK' });
          toast.success('Payment successful. Your course is unlocked.');
        }
      },
      onError: (err) => {
        setPaymentFailed(true);
        const code = err instanceof ApiError ? err.code : null;
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
        onSuccess: (data) => {
          setManualPaymentSubmitted(true);
          setOrder((current) => (current ? { ...current, status: data?.status ?? current.status } : current));
          toast.success('Payment submitted. The course owner must verify it before access is unlocked.');
        },
        onError: (err) => {
          const code = err instanceof ApiError ? err.code : null;
          if (code === 'INVALID_TRANSACTION_ID') {
            setManualPaymentError('Transaction ID is required for bank transfer submissions.');
            return;
          }
          toast.error(code === 'PAYMENT_NOT_PENDING' ? 'This payment can no longer be submitted.' : 'We could not submit your payment. Please try again.');
        },
      },
    );
  }

  if (userLoading || courseLoading) {
    return <PageLoading />;
  }

  if (stripeVerifying) {
    return <PageLoading />;
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

  const { originalPrice, currentPrice, hasDiscount } = getCoursePricing(course.price, course.discountPrice);
  const finalAmount = currentPrice ?? 0;

  if (order?.status === 'PAID') {
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
              <h1 className="text-2xl font-bold text-neutral-900">Payment Successful</h1>
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

  const isManualPending = Boolean(order && order.status === 'PENDING' && order.paymentMethod && order.paymentMethod !== 'MOCK');
  const pendingOrder = isManualPending ? order : null;

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
        ) : pendingOrder ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="border-b border-neutral-200 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Payment pending</p>
                  <h1 className="mt-1 text-2xl font-bold text-neutral-900">Awaiting verification</h1>
                </div>
                <Badge variant="warning">Pending</Badge>
              </div>
            </div>

            <div className="space-y-6 p-6">
              <dl className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-neutral-600">Course</dt>
                  <dd className="text-right font-medium text-neutral-900">{course.title}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-neutral-600">Amount</dt>
                  <dd className="text-right font-semibold text-neutral-900">{currency(finalAmount)}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-neutral-600">Payment method</dt>
                  <dd className="text-right font-medium text-neutral-900">{paymentMethodMeta[pendingOrder.paymentMethod ?? 'COD'].label}</dd>
                </div>
                {pendingOrder.paymentMethod === 'BANK_TRANSFER' && (
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-neutral-600">Transaction ID</dt>
                    <dd className="text-right font-medium text-neutral-900">{transactionId || 'Not submitted yet'}</dd>
                  </div>
                )}
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-neutral-600">Order</dt>
                  <dd className="text-right font-medium text-neutral-900">{pendingOrder.id}</dd>
                </div>
              </dl>

              {pendingOrder.paymentMethod === 'BANK_TRANSFER' && !manualPaymentSubmitted && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-sm font-medium text-neutral-900">Add your transfer reference</p>
                  <p className="mt-1 text-sm text-neutral-600">Please enter the transaction ID you used when you sent the bank transfer. The course remains locked until the owner approves the payment.</p>
                  <div className="mt-4 space-y-3">
                    <Input
                      label="Transaction ID"
                      value={transactionId}
                      onChange={(event) => setTransactionId(event.target.value)}
                      placeholder="e.g. TXN-123456"
                      error={manualPaymentError}
                    />
                    <Button onClick={handleManualSubmit} loading={submitManualPayment.isPending} fullWidth>
                      Submit payment details
                    </Button>
                  </div>
                </div>
              )}

              {manualPaymentSubmitted && (
                <div className="rounded-xl border border-success-200 bg-success-50 p-4 text-sm text-success-700">
                  Payment submitted successfully. Your order is pending review and access will be granted only after approval.
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row-reverse">
                <LinkButton href="/dashboard/student" variant="outline">Back to dashboard</LinkButton>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="border-b border-neutral-200 p-6">
              <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Checkout</p>
              <h1 className="mt-1 text-2xl font-bold text-neutral-900">Complete your enrollment</h1>
            </div>

            <div className="p-6">
              {paymentFailed && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <p className="font-semibold">Payment Failed</p>
                  <p className="mt-1">Your course has not been unlocked.</p>
                </div>
              )}

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
                  <dt className="text-neutral-600">{hasDiscount ? 'Original price' : 'Price'}</dt>
                  <dd className={`text-right font-medium${hasDiscount ? ' text-neutral-400 line-through' : ' text-neutral-900'}`}>
                    {currency(originalPrice ?? 0)}
                  </dd>
                </div>
                {hasDiscount && (
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-neutral-600">Current price</dt>
                    <dd className="text-right font-semibold text-success-700">{currency(finalAmount)}</dd>
                  </div>
                )}
                <div className="flex items-start justify-between gap-4 border-t border-neutral-200 pt-3">
                  <dt className="text-lg font-semibold text-neutral-900">Total</dt>
                  <dd className="text-right text-2xl font-bold text-neutral-900">{currency(finalAmount)}</dd>
                </div>
              </dl>

              <div className="mt-6 space-y-3">
                {(['COD', 'BANK_TRANSFER', 'STRIPE'] as PaymentMethod[]).map((method) => {
                  const meta = paymentMethodMeta[method];
                  const isSelected = selectedPaymentMethod === method;
                  const isDisabled = false;

                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => {
                        if (!isDisabled) {
                          setSelectedPaymentMethod(method);
                        }
                      }}
                      disabled={isDisabled}
                      className={`flex w-full items-start justify-between gap-4 rounded-xl border-2 p-4 text-left transition ${
                        isDisabled ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 opacity-70' : isSelected ? 'border-primary-600 bg-primary-50' : 'border-[#d9b894] bg-white hover:border-primary-400'
                      }`}
                    >
                      <div>
                        <p className="text-base font-semibold text-neutral-900">{meta.label}</p>
                        <p className="mt-1 text-sm text-neutral-600">{meta.description}</p>
                        {method === 'BANK_TRANSFER' && (
                          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-warning-700">Pending review required</p>
                        )}
                        {method === 'COD' && (
                          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-warning-700">Pending review required</p>
                        )}
                      </div>
                      <span className={`mt-1 h-5 w-5 rounded-full border-2 ${isSelected ? 'border-primary-600 bg-primary-600' : isDisabled ? 'border-neutral-300 bg-neutral-200' : 'border-neutral-300 bg-white'}`} />
                    </button>
                  );
                })}
              </div>

              {selectedPaymentMethod === 'BANK_TRANSFER' && (
                <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                  <p className="font-medium text-neutral-900">Bank transfer instructions</p>
                  <p className="mt-1">Use the course owner’s bank details to complete the transfer, then enter the transaction ID before submitting. Access stays pending until the owner verifies the payment.</p>
                </div>
              )}

              {selectedPaymentMethod === 'COD' && (
                <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                  <p className="font-medium text-neutral-900">Cash on delivery</p>
                  <p className="mt-1">Your payment will remain pending until the course owner confirms the order.</p>
                </div>
              )}

              {selectedPaymentMethod === 'STRIPE' && (
                <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                  <p className="font-medium text-neutral-900">Stripe</p>
                  <p className="mt-1">Coming soon. Please select another payment method.</p>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
                <Button size="lg" loading={checkout.isPending} onClick={handleCheckout} disabled={checkout.isPending}>
                  {checkout.isPending ? 'Creating checkout...' : 'Continue with selected payment'}
                </Button>
                <LinkButton href={`/courses/${courseId}`} variant="outline" size="lg">Cancel</LinkButton>
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