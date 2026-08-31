'use client';

import { useEffect } from 'react';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { AuditLogTable } from '@/components/audit/AuditLogTable';
import { PageHeader } from '@/components/dashboard';

export default function OrgAuditLogsPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();

  useEffect(() => {
    if (userLoading) return;
    if (!user || user.role !== 'ORG_ADMIN') {
      window.location.href = '/login';
    }
  }, [user, userLoading]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        subtitle="Organization Admin"
        title="Audit Logs"
        description="A record of security-relevant events inside your organization, including logins, publishing, enrollments, and certificates."
      />
      <AuditLogTable apiPath="/api/v1/org/audit-logs" />
    </div>
  );
}
