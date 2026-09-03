'use client';

import { useEffect } from 'react';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { PageHeader } from '@/components/dashboard';
import { AuditLogTable } from '@/components/audit/AuditLogTable';

export default function PlatformAuditLogsPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    if (user.role !== 'PLATFORM_ADMIN') {
      window.location.href = '/login';
    }
  }, [user, userLoading]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Audit Logs" />
      <AuditLogTable apiPath="/api/v1/admin/audit-logs" showOrganization pageSize={50} />
    </div>
  );
}
