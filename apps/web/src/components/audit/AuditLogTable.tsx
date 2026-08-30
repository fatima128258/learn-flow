'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, EmptyState, EmptyStateIcons, ErrorState, Input, Spinner } from '@/components/ui';

export type AuditLogItem = {
  id: string;
  action: string;
  organizationId: string | null;
  actor: { userId: string; email: string | null; role: string | null };
  resource: { type: string | null; id: string | null };
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
};

type Meta = { page: number; limit: number; total: number };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

function actorLabel(item: AuditLogItem) {
  return item.actor.email ?? item.actor.role ?? item.actor.userId;
}

interface AuditLogTableProps {
  apiPath: string;
  showOrganization?: boolean;
  pageSize?: number;
}

export const AuditLogTable: React.FC<AuditLogTableProps> = ({
  apiPath,
  showOrganization = false,
  pageSize = 20,
}) => {
  const [logs, setLogs] = useState<AuditLogItem[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (actionFilter) params.set('action', actionFilter);
      const res = await fetch(`${API_BASE}${apiPath}?${params.toString()}`, { credentials: 'include' });
      const body: { success?: boolean; data?: AuditLogItem[]; meta?: Partial<Meta> } = await res.json();
      if (!res.ok || !Array.isArray(body.data)) {
        setError('Could not load audit logs. Please try again.');
        return;
      }
      setLogs(body.data);
      setMeta({
        page: body.meta?.page ?? 1,
        limit: body.meta?.limit ?? pageSize,
        total: body.meta?.total ?? body.data.length,
      });
    } catch {
      setError('Could not reach the API. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [apiPath, page, pageSize, actionFilter]);

  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  return (
    <div>
      <div className="mb-4 max-w-xs">
        <Input
          label="Filter by action"
          placeholder="e.g. LOGIN, COURSE_PUBLISHED"
          value={actionFilter}
          onChange={(e) => {
            setError(null);
            setLoading(true);
            setActionFilter(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {loading && logs === null ? (
          <div className="flex items-center gap-3 p-8 text-neutral-700">
            <Spinner size="lg" label="Loading audit logs..." />
            <span>Loading audit logs...</span>
          </div>
        ) : error ? (
          <ErrorState
            title="Unable to load audit logs"
            message={error}
            action={{ label: 'Retry', onClick: () => { setError(null); setLoading(true); void load(); } }}
          />
        ) : logs && logs.length === 0 ? (
          <EmptyState
            icon={EmptyStateIcons.NoData}
            title={actionFilter ? 'No matching events' : 'No audit events yet'}
            description={
              actionFilter
                ? `Nothing matched "${actionFilter}". Try a different action filter.`
                : 'Security and business events will appear here as they happen.'
            }
          />
        ) : (
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Action</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Actor</th>
                {showOrganization && (
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Organization</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Resource</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {(logs ?? []).map((log) => (
                <tr key={log.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4">
                    <Badge variant="info" size="sm">{log.action}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-700">{actorLabel(log)}</td>
                  {showOrganization && (
                    <td className="px-6 py-4 text-sm text-neutral-500">
                      {log.organizationId ? log.organizationId.slice(0, 8) : '—'}
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm text-neutral-600">
                    {log.resource.type ? (
                      <>
                        {log.resource.type}
                        {log.resource.id ? ` · ${log.resource.id}` : ''}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-700">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {meta && meta.total > meta.limit ? (
          <div className="flex items-center justify-between border-t border-neutral-200 px-6 py-4">
            <p className="text-sm text-neutral-600">
              Page {meta.page} of {totalPages} · {meta.total} events
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => { setError(null); setLoading(true); setPage((p) => Math.max(1, p - 1)); }}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => { setError(null); setLoading(true); setPage((p) => Math.min(totalPages, p + 1)); }}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

AuditLogTable.displayName = 'AuditLogTable';