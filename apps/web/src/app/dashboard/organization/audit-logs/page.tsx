'use client';

import { useEffect } from 'react';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { PageHeader } from '@/components/dashboard';
import { AuditLogTable } from '@/components/audit/AuditLogTable';

export default function OrgAuditLogsPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();

  useEffect(() => {
    if (userLoading) return;
    if (!user || (user.role !== 'ORG_ADMIN' && user.role !== 'PLATFORM_ADMIN')) {
      window.location.href = '/login';
    }
  }, [user, userLoading]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Audit Logs" />
      <AuditLogTable apiPath="/api/v1/org/audit-logs" />
    </div>
  );
}
