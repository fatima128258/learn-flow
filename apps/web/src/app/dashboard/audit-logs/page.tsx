'use client';

import { useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { platformAdminNav } from '@/features/platformAdmin/nav';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { AuditLogTable } from '@/components/audit/AuditLogTable';
import { PageHeader } from '@/components/dashboard';

export default function PlatformAuditLogsPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();

  useEffect(() => {
    if (userLoading) return;
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      window.location.href = '/dashboard/organization';
    }
  }, [user, userLoading]);

  return (
    <DashboardLayout navLabel="Platform Admin" items={platformAdminNav}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          subtitle="Platform Admin"
          title="Audit Logs"
          description="Platform-wide security events across all organizations."
        />
        <AuditLogTable apiPath="/api/v1/admin/audit-logs" showOrganization pageSize={50} />
      </div>
    </DashboardLayout>
  );
}
