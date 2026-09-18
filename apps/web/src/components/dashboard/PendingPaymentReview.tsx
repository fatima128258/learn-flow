'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Card, EmptyState, Modal } from '@/components/ui';
import { getJson, postJson } from '@/lib/api';

export type PendingPaymentListItem = {
  id: string;
  status: string;
  paymentMethod: 'COD' | 'BANK_TRANSFER';
  transactionId?: string | null;
  amount: number;
  createdAt: string;
  rejectionReason?: string | null;
  order: {
    id: string;
    status: string;
    totalAmount: number;
    items: Array<{ courseId: string; courseTitle: string; lineTotal: number }>;
  };
  user: {
    id: string;
    name: string | null;
    email: string;
  };
};

export function PendingPaymentReview({ organizationId }: { organizationId: string }) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [workingId, setWorkingId] = useState<string | null>(null);

  const { data = [], refetch, isLoading } = useQuery({
    queryKey: ['payments', 'pending', organizationId],
    queryFn: async () => {
      const response = await getJson<{ data?: PendingPaymentListItem[] }>(
        `/api/v1/organizations/${organizationId}/payments/pending`,
      );
      return response.data ?? [];
    },
    enabled: Boolean(organizationId),
  });

  const payments = useMemo(() => data ?? [], [data]);

  async function handleApprove(paymentId: string) {
    setWorkingId(paymentId);
    try {
      await postJson(`/api/v1/organizations/${organizationId}/payments/${paymentId}/approve`, {});
      await refetch();
    } finally {
      setWorkingId(null);
    }
  }

  async function handleReject(paymentId: string) {
    const trimmed = rejectReason.trim();
    if (!trimmed) return;
    setWorkingId(paymentId);
    try {
      await postJson(`/api/v1/organizations/${organizationId}/payments/${paymentId}/reject`, {
        reason: trimmed,
      });
      setRejectingId(null);
      setRejectReason('');
      await refetch();
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="mb-8">
      <Card className="overflow-hidden">
        <div className="border-b border-neutral-200 px-6 py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Payments</p>
              <h2 className="mt-1 text-xl font-semibold text-neutral-900">Pending manual payments</h2>
            </div>
            <Badge variant="warning" size="sm">{payments.length} pending</Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm text-neutral-600">Loading pending payments…</div>
        ) : payments.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No pending manual payments" description="Approved and rejected payments will disappear once reviewed." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-6 py-3 font-medium">Student</th>
                  <th className="px-6 py-3 font-medium">Course</th>
                  <th className="px-6 py-3 font-medium">Method</th>
                  <th className="px-6 py-3 font-medium">Transaction ID</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Submitted</th>
                  <th className="px-6 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const courseTitle = payment.order.items[0]?.courseTitle ?? 'Course';
                  const submittedAt = payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

                  return (
                    <tr key={payment.id} className="border-t border-neutral-200 align-top">
                      <td className="px-6 py-4">
                        <div className="font-medium text-neutral-900">{payment.user.name ?? 'Student'}</div>
                        <div className="text-xs text-neutral-500">{payment.user.email}</div>
                      </td>
                      <td className="px-6 py-4 text-neutral-700">{courseTitle}</td>
                      <td className="px-6 py-4">
                        <Badge variant={payment.paymentMethod === 'BANK_TRANSFER' ? 'info' : 'warning'} size="sm">
                          {payment.paymentMethod === 'BANK_TRANSFER' ? 'Bank Transfer' : 'COD'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-neutral-700">{payment.transactionId || '—'}</td>
                      <td className="px-6 py-4 font-medium text-neutral-900">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(payment.amount || payment.order.totalAmount || 0)}
                      </td>
                      <td className="px-6 py-4 text-neutral-700">{submittedAt}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            size="sm"
                            variant="primary"
                            loading={workingId === payment.id}
                            onClick={() => void handleApprove(payment.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            loading={workingId === payment.id}
                            onClick={() => setRejectingId(payment.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={Boolean(rejectingId)}
        onClose={() => { setRejectingId(null); setRejectReason(''); }}
        title="Reject payment"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setRejectingId(null); setRejectReason(''); }} disabled={workingId !== null}>
              Cancel
            </Button>
            <Button variant="danger" loading={workingId !== null} onClick={() => { if (rejectingId) void handleReject(rejectingId); }}>
              Reject payment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Add a brief rejection reason so the student knows why the payment was declined.
          </p>
          <textarea
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            rows={4}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-900 outline-none focus:border-primary-600"
            placeholder="e.g. Transfer amount did not match the invoice."
          />
        </div>
      </Modal>
    </div>
  );
}
