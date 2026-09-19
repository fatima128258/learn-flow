'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Card, EmptyState, ErrorState, Input, Spinner, ViewToggle } from '@/components/ui';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { getJson } from '@/lib/api';
import { currency } from '@/lib/types';

type StudentPayment = {
  id: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  paymentMethod: 'COD' | 'BANK_TRANSFER' | null;
  transactionId: string | null;
  amount: number;
  currency: string;
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  order: {
    id: string;
    status: string;
    items: Array<{ courseId: string; courseTitle: string }>;
  };
};

function paymentStatus(payment: StudentPayment) {
  if (payment.status === 'SUCCEEDED') return { label: 'Approved', variant: 'success' as const };
  if (payment.status === 'FAILED') return { label: 'Rejected', variant: 'error' as const };
  return { label: 'Pending', variant: 'warning' as const };
}

function firstThreeWords(value: string) {
  return value.trim().split(/\s+/).slice(0, 3).join(' ') || 'Course';
}

export default function StudentPaymentsPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const organizationId = user?.organizationId ?? '';
  const [searchInput, setSearchInput] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  useEffect(() => {
    if (userLoading) return;
    if (!user || user.role !== 'STUDENT') {
      window.location.href = user?.role === 'INSTRUCTOR'
        ? '/dashboard/instructor'
        : user?.role === 'ORG_ADMIN'
          ? '/dashboard/organization'
          : '/login';
    }
  }, [user, userLoading]);

  const { data: payments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['student', 'payments', organizationId],
    queryFn: async () => {
      const response = await getJson<{ data?: StudentPayment[] }>(
        `/api/v1/organizations/${organizationId}/student/payments`,
      );
      return response.data ?? [];
    },
    enabled: user?.role === 'STUDENT' && Boolean(organizationId),
  });

  const filteredPayments = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    if (!query) return payments;
    return payments.filter((payment) => {
      const courseTitle = payment.order.items[0]?.courseTitle ?? '';
      const status = paymentStatus(payment).label;
      const method = payment.paymentMethod === 'BANK_TRANSFER' ? 'bank transfer' : payment.paymentMethod === 'COD' ? 'cash on delivery cod' : '';
      return [courseTitle, payment.transactionId, status, method]
        .some((value) => value?.toLowerCase().includes(query));
    });
  }, [payments, searchInput]);

  if (userLoading || (isLoading && !user)) {
    return (
      <div className="flex min-h-64 items-center justify-center" role="status" aria-label="Loading payments">
        <Spinner size="md" label="Loading..." />
      </div>
    );
  }

  if (!user || user.role !== 'STUDENT') return null;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          variant="line"
          placeholder="Search by course, method, status, or transaction ID"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="max-w-xl"
        />
        <ViewToggle
          value={viewMode}
          onChange={setViewMode}
          storageKey="learnhub-student-payments-view"
        />
      </div>
      {isError ? (
        <Card>
          <ErrorState
            title="Unable to load payments"
            message="Your payment history could not be loaded. Please try again."
            action={{ label: 'Retry', onClick: () => void refetch() }}
          />
        </Card>
      ) : payments.length === 0 ? (
        <Card>
          <EmptyState
            title="No payments yet"
            description="Your course payment history will appear here after you place an order."
          />
        </Card>
      ) : filteredPayments.length === 0 ? (
        <Card>
          <EmptyState title="No matching payments" description="Try a different course, method, status, or transaction ID." />
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className={viewMode === 'table' ? 'hidden sm:block' : 'hidden'}>
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-6 py-3 font-medium">Course</th>
                  <th className="px-6 py-3 font-medium">Method</th>
                  <th className="px-6 py-3 font-medium">Transaction ID</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => {
                  const status = paymentStatus(payment);
                  const courseTitle = firstThreeWords(payment.order.items[0]?.courseTitle ?? 'Course');
                  return (
                    <tr key={payment.id} className="border-t border-neutral-200">
                      <td className="px-6 py-4 font-medium text-neutral-900">{courseTitle}</td>
                      <td className="px-6 py-4 text-neutral-700">
                        {payment.paymentMethod === 'BANK_TRANSFER' ? 'Bank Transfer' : payment.paymentMethod === 'COD' ? 'Cash on Delivery' : '—'}
                      </td>
                      <td className="px-6 py-4 text-neutral-700">{payment.transactionId || '—'}</td>
                      <td className="px-6 py-4 font-medium text-neutral-900">{currency(payment.amount)}</td>
                      <td className="px-6 py-4 text-neutral-700">
                        {new Date(payment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={status.variant} size="sm">{status.label}</Badge>
                        {payment.rejectionReason && (
                          <p className="mt-1 max-w-xs text-xs text-error-700">{payment.rejectionReason}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={viewMode === 'cards' ? 'grid gap-4 p-4 md:grid-cols-3' : 'grid gap-4 p-4 sm:hidden'}>
            {filteredPayments.map((payment) => {
              const status = paymentStatus(payment);
              const courseTitle = firstThreeWords(payment.order.items[0]?.courseTitle ?? 'Course');
              return (
                <div key={payment.id} className="rounded-2xl border border-[#ead8c6] bg-[#fffdf9] p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold text-neutral-900">{courseTitle}</h2>
                    <Badge variant={status.variant} size="sm">{status.label}</Badge>
                  </div>
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500">Method</dt>
                      <dd className="text-right text-neutral-700">{payment.paymentMethod === 'BANK_TRANSFER' ? 'Bank Transfer' : payment.paymentMethod === 'COD' ? 'Cash on Delivery' : '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500">Transaction ID</dt>
                      <dd className="max-w-[60%] break-all text-right text-neutral-700">{payment.transactionId || '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500">Amount</dt>
                      <dd className="font-medium text-neutral-900">{currency(payment.amount)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500">Date</dt>
                      <dd className="text-right text-neutral-700">{new Date(payment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</dd>
                    </div>
                  </dl>
                  {payment.rejectionReason && <p className="mt-3 text-xs text-error-700">{payment.rejectionReason}</p>}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
