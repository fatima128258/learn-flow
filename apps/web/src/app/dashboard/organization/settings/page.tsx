'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, Button, Card, ErrorState, Input, OrganizationPageLoader, Spinner } from '@/components/ui';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { PageHeader, SectionHeader } from '@/components/dashboard';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';

export const dynamic = 'force-dynamic';

type OrganizationInfo = {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
};

type BankDetails = {
  bankName: string;
  accountNumber: string;
};

const API_BASE = '';

function OrgSettingsContent() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const toast = useToast();
  const searchParams = useSearchParams();
  const orgId = searchParams.get('organization') || user?.organizationId || '';
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [bankForm, setBankForm] = useState<BankDetails>({ bankName: '', accountNumber: '' });
  const [bankEditing, setBankEditing] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSubmitting, setBankSubmitting] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading) return;
    if (!user || (user.role !== 'ORG_ADMIN' && user.role !== 'PLATFORM_ADMIN')) {
      window.location.href = '/login';
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const headers: Record<string, string> = orgId ? { 'X-Organization-Id': orgId } : {};
        const res = await fetch(`${API_BASE}/api/v1/org/organization`, { credentials: 'include', headers });
        if (!res.ok) {
          setError('Could not load organization settings. Please try again.');
          return;
        }
        const body: { success?: boolean; data?: OrganizationInfo } = await res.json();
        setOrganization(body.data ?? null);
      } catch {
        setError('Could not reach the API. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [user, userLoading, orgId]);

  useEffect(() => {
    if (userLoading || !user || !orgId) return;
    let active = true;
    setBankLoading(true);
    apiRequest<{ data: BankDetails | null }>('/api/v1/organizations/org/payment-details', {
      headers: { 'X-Organization-Id': orgId },
    })
      .then((response) => {
        if (!active) return;
        setBankDetails(response.data);
        if (response.data) setBankForm({ bankName: response.data.bankName, accountNumber: '' });
      })
      .catch(() => {
        if (active) setBankError('Could not load bank settings.');
      })
      .finally(() => {
        if (active) setBankLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, userLoading, orgId]);

  async function saveBankDetails() {
    const bankName = bankForm.bankName.trim();
    const accountNumber = bankForm.accountNumber.trim();
    if (!bankName || !accountNumber) {
      setBankError('Please enter the bank name and account number.');
      return;
    }
    setBankSubmitting(true);
    setBankError(null);
    try {
      const response = await apiRequest<{ data: BankDetails }>('/api/v1/organizations/org/payment-details', {
        method: 'PATCH',
        headers: { 'X-Organization-Id': orgId },
        body: JSON.stringify({ bankName, accountNumber }),
      });
      setBankDetails(response.data);
      setBankForm({ bankName: response.data.bankName, accountNumber: '' });
      setBankEditing(false);
      toast.success('Bank settings saved.', 'Bank settings updated');
    } catch {
      setBankError('Could not save bank settings. Please try again.');
    } finally {
      setBankSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" />
        {loading ? (
          <OrganizationPageLoader />
        ) : error ? (
          <Card>
            <ErrorState title="Unable to load settings" message={error} />
          </Card>
        ) : organization ? (
          <>
            <div className="mb-8 rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="border-b border-neutral-200 px-6 py-4">
                <SectionHeader title="Organization" />
              </div>
              <dl className="divide-y divide-neutral-200 px-6">
                <div className="grid gap-1 py-4 sm:grid-cols-3">
                  <dt className="text-sm font-medium text-neutral-500">Name</dt>
                  <dd className="text-sm text-neutral-900 sm:col-span-2">{organization.name}</dd>
                </div>
                <div className="grid gap-1 py-4 sm:grid-cols-3">
                  <dt className="text-sm font-medium text-neutral-500">Slug</dt>
                  <dd className="text-sm text-neutral-900 sm:col-span-2">{organization.slug}</dd>
                </div>
                <div className="grid gap-1 py-4 sm:grid-cols-3">
                  <dt className="text-sm font-medium text-neutral-500">Status</dt>
                  <dd className="sm:col-span-2">
                    <Badge variant={organization.status === 'ACTIVE' ? 'success' : 'error'} size="sm">
                      {organization.status}
                    </Badge>
                  </dd>
                </div>
                <div className="grid gap-1 py-4 sm:grid-cols-3">
                  <dt className="text-sm font-medium text-neutral-500">Created</dt>
                  <dd className="text-sm text-neutral-900 sm:col-span-2">
                    {new Date(organization.createdAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mb-8 rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
                <SectionHeader title="Bank Settings" description="Add the bank name and account number for organization payments." />
                {bankDetails && !bankEditing && (
                  <Button variant="ghost" onClick={() => setBankEditing(true)}>
                    Edit
                  </Button>
                )}
              </div>
              <div className="p-6">
                {bankLoading ? (
                  <div className="flex min-h-24 items-center justify-center" role="status" aria-label="Loading bank settings">
                    <Spinner size="md" label="Loading..." />
                  </div>
                ) : bankError && !bankEditing ? (
                  <ErrorState title="Unable to load bank settings" message={bankError} />
                ) : !bankDetails && !bankEditing ? (
                  <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
                    <p className="text-sm text-neutral-600">No bank details have been added yet.</p>
                    <Button className="mt-4" onClick={() => setBankEditing(true)}>
                      Add Bank Details
                    </Button>
                  </div>
                ) : bankEditing ? (
                  <div className="space-y-4">
                    <Input
                      label="Bank Name"
                      value={bankForm.bankName}
                      onChange={(event) => setBankForm((current) => ({ ...current, bankName: event.target.value }))}
                      autoComplete="off"
                      disabled={bankSubmitting}
                    />
                    <Input
                      label="Account Number"
                      value={bankForm.accountNumber}
                      onChange={(event) => setBankForm((current) => ({ ...current, accountNumber: event.target.value }))}
                      autoComplete="off"
                      disabled={bankSubmitting}
                    />
                    {bankError && <p className="text-sm text-error-700">{bankError}</p>}
                    <div className="flex justify-end gap-3 pt-2">
                      {bankDetails && (
                        <Button variant="ghost" onClick={() => setBankEditing(false)} disabled={bankSubmitting}>
                          Cancel
                        </Button>
                      )}
                      <Button onClick={() => void saveBankDetails()} loading={bankSubmitting} loadingText="Saving...">
                        Save Bank Settings
                      </Button>
                    </div>
                  </div>
                ) : bankDetails ? (
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm text-neutral-500">Bank Name</dt>
                      <dd className="mt-1 font-medium text-neutral-900">{bankDetails.bankName}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-neutral-500">Account Number</dt>
                      <dd className="mt-1 font-medium text-neutral-900">
                        {bankDetails.accountNumber.length <= 4
                          ? '****'
                          : `${'*'.repeat(Math.max(4, bankDetails.accountNumber.length - 4))}${bankDetails.accountNumber.slice(-4)}`}
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="border-b border-neutral-200 px-6 py-4">
                <SectionHeader title="Administration" />
              </div>
              <ul className="divide-y divide-neutral-200 px-6">
                <li className="py-4 text-sm text-neutral-700">
                  <span className="font-semibold text-neutral-900">Your account</span> — You are signed in as{' '}
                  <span className="font-medium">{user?.email}</span>. Password and profile changes require the platform
                  administration.
                </li>
                <li className="py-4 text-sm text-neutral-700">
                  <span className="font-semibold text-neutral-900">Organization profile</span> — The organization name
                  and slug are managed by the platform administrator to keep identity consistent across the tenant.
                </li>
                <li className="py-4 text-sm text-neutral-700">
                  <span className="font-semibold text-neutral-900">Billing</span> — Invoices and plan settings are not yet available.
                </li>
              </ul>
            </div>
          </>
        ) : null}
    </div>
  );
}

function SettingsLoadingFallback() {
  return <OrganizationPageLoader />;
}

export default function OrgSettingsPage() {
  return (
    <Suspense fallback={<SettingsLoadingFallback />}>
      <OrgSettingsContent />
    </Suspense>
  );
}
