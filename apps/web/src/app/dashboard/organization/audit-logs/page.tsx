'use client';

import { useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { orgAdminNav } from '@/features/organizationAdmin/nav';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { AuditLogTable } from '@/components/audit/AuditLogTable';

export default function OrgAuditLogsPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();

  useEffect(() => {
    if (userLoading) return;
    if (!user || user.role !== 'ORG_ADMIN') {
      window.location.href = '/login';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userLoading]);

  return (
    <DashboardLayout navLabel="Organization Admin" items={orgAdminNav}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Organization Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-neutral-900">Audit Logs</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            A record of security-relevant events inside your organization, including logins, publishing, enrollments, and certificates.
          </p>
        </div>
        <AuditLogTable apiPath="/api/v1/org/audit-logs" />
      </div>
    </DashboardLayout>
  );
}