'use client';

import { useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { platformAdminNav } from '@/features/platformAdmin/nav';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { AuditLogTable } from '@/components/audit/AuditLogTable';

export default function PlatformAuditLogsPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();

  useEffect(() => {
    if (userLoading) return;
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      window.location.href = '/dashboard/organization';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userLoading]);

  return (
    <DashboardLayout navLabel="Platform Admin" items={platformAdminNav}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Platform Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-neutral-900">Audit Logs</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            Platform-wide security events across all organizations.
          </p>
        </div>
        <AuditLogTable apiPath="/api/v1/admin/audit-logs" showOrganization pageSize={50} />
      </div>
    </DashboardLayout>
  );
}