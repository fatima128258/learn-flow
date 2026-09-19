'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Drawer, EmptyState, Input, Modal, Spinner, ViewToggle } from '@/components/ui';
import { TableCard, tableCellClass, tableHeadClass, tableRowHoverClass } from './TableCard';
import { getJson, postJson } from '@/lib/api';

export type PendingPaymentListItem = {
  id: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  paymentMethod: 'COD' | 'BANK_TRANSFER' | 'STRIPE';
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

function firstThreeWords(value: string) {
  return value.trim().split(/\s+/).slice(0, 3).join(' ') || 'Course';
}

function paymentStatus(status: PendingPaymentListItem['status']) {
  if (status === 'SUCCEEDED') return { label: 'Completed', variant: 'success' as const };
  if (status === 'FAILED') return { label: 'Rejected', variant: 'error' as const };
  return { label: 'Pending', variant: 'warning' as const };
}

function PaymentActionsMenu({
  onView,
  onApprove,
  onReject,
}: {
  onView: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function toggleMenu() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, left: Math.max(8, rect.right - 144) });
    }
    setOpen((value) => !value);
  }

  const menu = open ? (
    <div
      ref={menuRef}
      className="fixed z-[70] w-36 rounded-xl border border-neutral-200 bg-white py-1 shadow-xl"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button type="button" className="block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50" onClick={() => { setOpen(false); onView(); }}>
        View
      </button>
      {onApprove && onReject && (
        <>
          <div className="mx-3 border-t border-neutral-100" />
          <button type="button" className="block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50" onClick={() => { setOpen(false); onApprove(); }}>
            Approve
          </button>
          <button type="button" className="block w-full px-3 py-2 text-left text-sm text-error-600 hover:bg-error-50" onClick={() => { setOpen(false); onReject(); }}>
            Reject
          </button>
        </>
      )}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Payment actions"
        className="inline-flex items-center justify-center rounded-lg p-2 text-neutral-700 hover:bg-neutral-100"
        onClick={toggleMenu}
      >
        <span className="sr-only">Payment actions</span>
        <span aria-hidden="true" className="text-lg leading-none">⋮</span>
      </button>
      {typeof document !== 'undefined' && menu ? createPortal(menu, document.body) : null}
    </>
  );
}

export function PendingPaymentReview({ organizationId }: { organizationId: string }) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedPayment, setSelectedPayment] = useState<PendingPaymentListItem | null>(null);

  const { data = [], refetch, isLoading } = useQuery({
    queryKey: ['payments', 'pending', organizationId],
    queryFn: async () => {
      const response = await getJson<{ data?: PendingPaymentListItem[] }>(
        `/api/v1/organizations/${organizationId}/payments`,
      );
      return response.data ?? [];
    },
    enabled: Boolean(organizationId),
  });

  const payments = useMemo(() => data ?? [], [data]);
  const filteredPayments = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    if (!query) return payments;
    return payments.filter((payment) => {
      const courseTitle = payment.order.items[0]?.courseTitle ?? '';
      return [
        payment.user.name,
        payment.user.email,
        courseTitle,
        payment.paymentMethod === 'STRIPE' ? 'stripe' : payment.paymentMethod === 'BANK_TRANSFER' ? 'bank transfer' : 'cod',
        payment.transactionId,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [payments, searchInput]);

  async function handleApprove(paymentId: string) {
    setWorkingId(paymentId);
    try {
      await postJson(`/api/v1/organizations/${organizationId}/payments/${paymentId}/approve`, {});
      const refreshed = await refetch();
      setSelectedPayment(refreshed.data?.find((payment) => payment.id === paymentId) ?? null);
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
      const refreshed = await refetch();
      setSelectedPayment(refreshed.data?.find((payment) => payment.id === paymentId) ?? null);
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="mb-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          variant="line"
          placeholder="Search by student, course, email, or transaction ID"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="max-w-xl"
        />
        <ViewToggle
          value={viewMode}
          onChange={setViewMode}
          storageKey="learnhub-organization-payments-view"
        />
      </div>
      <TableCard className={viewMode === 'cards' ? 'border-transparent bg-transparent shadow-none' : ''}>
        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center p-6">
            <Spinner size="lg" label="Loading pending payments" />
          </div>
        ) : payments.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No pending manual payments" description="Approved and rejected payments will disappear once reviewed." />
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No matching payments" description="Try a different student, course, email, or transaction ID." />
          </div>
        ) : (
          <>
          <div className={viewMode === 'table' ? 'hidden sm:block' : 'hidden'}>
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className={tableHeadClass}>Student</th>
                  <th className={tableHeadClass}>Course</th>
                  <th className={tableHeadClass}>Status</th>
                  <th className={tableHeadClass}>Method</th>
                  <th className={tableHeadClass}>Amount</th>
                  <th className={tableHeadClass}>Submitted</th>
                  <th className={`${tableHeadClass} text-center`}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredPayments.map((payment) => {
                  const courseTitle = firstThreeWords(payment.order.items[0]?.courseTitle ?? 'Course');
                  const submittedAt = payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

                  return (
                    <tr key={payment.id} className={tableRowHoverClass}>
                      <td className={tableCellClass}>
                        <div className="font-medium text-neutral-900">{payment.user.name ?? 'Student'}</div>
                        <div className="text-xs text-neutral-500">{payment.user.email}</div>
                      </td>
                      <td className={`${tableCellClass} text-neutral-700`}>{courseTitle}</td>
                      <td className={tableCellClass}>
                        <Badge variant={paymentStatus(payment.status).variant} size="sm">
                          {paymentStatus(payment.status).label}
                        </Badge>
                      </td>
                      <td className={tableCellClass}>
                        <Badge variant={payment.paymentMethod === 'STRIPE' ? 'info' : payment.paymentMethod === 'BANK_TRANSFER' ? 'info' : 'warning'} size="sm">
                          {payment.paymentMethod === 'STRIPE' ? 'Stripe' : payment.paymentMethod === 'BANK_TRANSFER' ? 'Bank Transfer' : 'COD'}
                        </Badge>
                      </td>
                      <td className={`${tableCellClass} font-medium text-neutral-900`}>
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(payment.amount || payment.order.totalAmount || 0)}
                      </td>
                      <td className={`${tableCellClass} text-neutral-700`}>{submittedAt}</td>
                      <td className={`${tableCellClass} text-center`}>
                        <div className="flex items-center justify-center gap-2">
                          <PaymentActionsMenu
                            onView={() => setSelectedPayment(payment)}
                            onApprove={payment.status === 'PENDING' && payment.paymentMethod !== 'STRIPE' ? () => void handleApprove(payment.id) : undefined}
                            onReject={payment.status === 'PENDING' && payment.paymentMethod !== 'STRIPE' ? () => setRejectingId(payment.id) : undefined}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={viewMode === 'cards' ? 'grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3' : 'grid gap-4 p-4 sm:hidden'}>
            {filteredPayments.map((payment) => {
              const courseTitle = firstThreeWords(payment.order.items[0]?.courseTitle ?? 'Course');
              const submittedAt = payment.createdAt
                ? new Date(payment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—';
              return (
                <div key={payment.id} className="w-full max-w-xl justify-self-start rounded-2xl border border-[#ead8c6] bg-[#fffdf9] p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-neutral-900">{payment.user.name ?? 'Student'}</p>
                      <p className="mt-1 text-xs text-neutral-500">{payment.user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={paymentStatus(payment.status).variant} size="sm">{paymentStatus(payment.status).label}</Badge>
                      <Badge variant={payment.paymentMethod === 'STRIPE' ? 'info' : payment.paymentMethod === 'BANK_TRANSFER' ? 'info' : 'warning'} size="sm">
                        {payment.paymentMethod === 'STRIPE' ? 'Stripe' : payment.paymentMethod === 'BANK_TRANSFER' ? 'Bank Transfer' : 'COD'}
                      </Badge>
                    </div>
                  </div>
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500">Course</dt>
                      <dd className="max-w-[70%] truncate text-right font-medium text-neutral-900">{courseTitle}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500">Amount</dt>
                      <dd className="font-medium text-neutral-900">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(payment.amount || payment.order.totalAmount || 0)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500">Submitted</dt>
                      <dd className="text-neutral-700">{submittedAt}</dd>
                    </div>
                  </dl>
                  {payment.status === 'PENDING' && (
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" variant="primary" fullWidth loading={workingId === payment.id} onClick={() => void handleApprove(payment.id)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="cream" fullWidth loading={workingId === payment.id} onClick={() => setRejectingId(payment.id)}>
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </>
        )}
      </TableCard>

      <Drawer
        isOpen={Boolean(selectedPayment)}
        onClose={() => setSelectedPayment(null)}
        title={selectedPayment?.order.items[0]?.courseTitle ?? 'Payment details'}
      >
        {selectedPayment ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-neutral-500">Payment status</p>
              <Badge variant={paymentStatus(selectedPayment.status).variant} size="sm">
                {paymentStatus(selectedPayment.status).label}
              </Badge>
            </div>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Student</h3>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="font-semibold text-neutral-900">{selectedPayment.user.name ?? 'Student'}</p>
                <p className="mt-1 text-sm text-neutral-600">{selectedPayment.user.email}</p>
                <p className="mt-2 break-all text-xs text-neutral-500">User ID: {selectedPayment.user.id}</p>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Payment</h3>
              <dl className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
                <div className="flex justify-between gap-4 p-4 text-sm">
                  <dt className="text-neutral-500">Method</dt>
                  <dd className="font-medium text-neutral-900">{selectedPayment.paymentMethod === 'STRIPE' ? 'Stripe' : selectedPayment.paymentMethod === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Cash on Delivery'}</dd>
                </div>
                <div className="flex justify-between gap-4 p-4 text-sm">
                  <dt className="text-neutral-500">Amount</dt>
                  <dd className="font-semibold text-neutral-900">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(selectedPayment.amount || selectedPayment.order.totalAmount || 0)}</dd>
                </div>
                <div className="flex justify-between gap-4 p-4 text-sm">
                  <dt className="text-neutral-500">Transaction ID</dt>
                  <dd className="max-w-[60%] break-all text-right font-medium text-neutral-900">{selectedPayment.transactionId || '—'}</dd>
                </div>
                <div className="flex justify-between gap-4 p-4 text-sm">
                  <dt className="text-neutral-500">Submitted</dt>
                  <dd className="text-right text-neutral-700">{new Date(selectedPayment.createdAt).toLocaleString('en-US')}</dd>
                </div>
              </dl>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Order</h3>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                <p className="text-neutral-500">Order ID</p>
                <p className="mt-1 break-all font-medium text-neutral-900">{selectedPayment.order.id}</p>
                <p className="mt-3 text-neutral-500">Course</p>
                <p className="mt-1 font-medium text-neutral-900">{selectedPayment.order.items[0]?.courseTitle ?? 'Course'}</p>
              </div>
            </section>

            {selectedPayment.status === 'PENDING' && selectedPayment.paymentMethod !== 'STRIPE' && (
              <div className="flex gap-3 border-t border-neutral-200 pt-5">
                <Button fullWidth variant="primary" loading={workingId === selectedPayment.id} onClick={() => void handleApprove(selectedPayment.id)}>
                  Approve
                </Button>
                <Button fullWidth variant="cream" disabled={workingId !== null} onClick={() => setRejectingId(selectedPayment.id)}>
                  Reject
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </Drawer>

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
            <Button variant="cream" loading={workingId !== null} onClick={() => { if (rejectingId) void handleReject(rejectingId); }}>
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
