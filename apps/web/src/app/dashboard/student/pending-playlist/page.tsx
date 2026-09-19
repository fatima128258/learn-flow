'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Badge, Card, EmptyState, ErrorState, DashboardSkeleton } from '@/components/ui';
import { PageHeader } from '@/components/dashboard';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { getJson } from '@/lib/api';
import { currency } from '@/lib/types';

type PendingPayment = {
  id: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  paymentMethod: 'COD' | 'BANK_TRANSFER' | null;
  transactionId: string | null;
  amount: number;
  createdAt: string;
  order: {
    id: string;
    items: Array<{ courseId: string; courseTitle: string }>;
  };
};

export default function PendingPlaylistPage() {
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
    queryKey: ['student', 'payments', 'pending-playlist', organizationId],
    queryFn: async () => {
      const response = await getJson<{ data?: PendingPayment[] }>(
        `/api/v1/organizations/${organizationId}/student/payments`,
      );
      return (response.data ?? []).filter((payment) => payment.status === 'PENDING');
    },
    enabled: user?.role === 'STUDENT' && Boolean(organizationId),
  });

  if (userLoading || isLoading) {
    return <DashboardSkeleton cards={3} />;
  }

  if (!user || user.role !== 'STUDENT') return null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Pending Playlist"
        description="Courses waiting for payment approval. Access will unlock after the owner approves your payment."
        className="-mt-4 mb-0 !py-1"
      />

      {isError ? (
        <Card>
          <ErrorState
            title="Unable to load pending playlist"
            message="Your pending courses could not be loaded. Please try again."
            action={{ label: 'Retry', onClick: () => void refetch() }}
          />
        </Card>
      ) : payments.length === 0 ? (
        <Card>
          <EmptyState
            title="No pending courses"
            description="Courses with payments awaiting approval will appear here."
          />
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {payments.map((payment) => {
            const item = payment.order.items[0];
            if (!item) return null;

            return (
              <Card key={payment.id} padding="none" className="overflow-hidden">
                <div className="relative flex h-36 items-end bg-gradient-to-br from-primary-700 to-primary-900 p-4">
                  <Badge
                    variant="warning"
                    size="sm"
                    className="absolute left-4 top-4 bg-white text-[#7a4a2e]"
                  >
                    Pending Approval
                  </Badge>
                  <span className="text-sm font-medium text-white/80">Payment awaiting review</span>
                </div>
                <div className="p-5">
                  <h2 className="line-clamp-2 text-lg font-semibold text-neutral-900">
                    {item.courseTitle}
                  </h2>
                  <div className="mt-3 space-y-1 text-sm text-neutral-600">
                    <p>
                      Method:{' '}
                      <span className="font-medium text-neutral-800">
                        {payment.paymentMethod === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Cash on Delivery'}
                      </span>
                    </p>
                    <p>
                      Amount: <span className="font-medium text-neutral-800">{currency(payment.amount)}</span>
                    </p>
                    {payment.transactionId && (
                      <p className="truncate">
                        Transaction ID: <span className="font-medium text-neutral-800">{payment.transactionId}</span>
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/checkout/${item.courseId}`}
                    className="mt-5 block rounded-xl bg-primary-700 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-800"
                  >
                    View payment details
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
