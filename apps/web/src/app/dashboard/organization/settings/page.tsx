'use client';

import { useEffect, useState } from 'react';
import { Badge, Card, ErrorState, Skeleton } from '@/components/ui';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { orgAdminNav } from '@/features/organizationAdmin/nav';
import { useCurrentUser } from '@/features/auth/useCurrentUser';

type OrganizationInfo = {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function OrgSettingsPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading) return;
    if (!user || user.role !== 'ORG_ADMIN') {
      window.location.href = '/login';
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/v1/org/organization`, { credentials: 'include' });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userLoading]);

  return (
    <DashboardLayout navLabel="Organization Admin" items={orgAdminNav}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Organization Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-neutral-900">Settings</h1>
        </div>

        {loading ? (
          <Card>
            <div className="space-y-4">
              <Skeleton variant="text" height={24} width={200} />
              <Skeleton variant="text" height={24} width={320} />
              <Skeleton variant="text" height={24} width={240} />
            </div>
          </Card>
        ) : error ? (
          <Card>
            <ErrorState title="Unable to load settings" message={error} />
          </Card>
        ) : organization ? (
          <>
            <div className="mb-8 rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="border-b border-neutral-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-neutral-900">Organization</h2>
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

            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="border-b border-neutral-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-neutral-900">Administration</h2>
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
    </DashboardLayout>
  );
}