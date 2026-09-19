'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Card, EmptyState, ErrorState, DashboardSkeleton } from '@/components/ui';
import { PageHeader } from '@/components/dashboard';
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

export default function StudentPaymentsPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const organizationId = user?.organizationId ?? '';

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

  if (userLoading || (isLoading && !user)) {
    return <DashboardSkeleton cards={1} />;
  }

  if (!user || user.role !== 'STUDENT') return null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Payments"
        description="Track your pending, approved, and rejected course payments."
        className="-mt-4 mb-0 !py-1"
      />

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
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
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
                {payments.map((payment) => {
                  const status = paymentStatus(payment);
                  const courseTitle = payment.order.items[0]?.courseTitle ?? 'Course';
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
        </Card>
      )}
    </div>
  );
}
