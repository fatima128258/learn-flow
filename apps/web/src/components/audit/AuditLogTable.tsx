'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  Input,
  Spinner,
} from '@/components/ui';

export type AuditLogItem = {
  id: string;
  action: string;
  organization: { id: string | null; name: string | null };
  actor: { userId: string; name: string | null; email: string | null; role: string | null };
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
};

type Meta = { page: number; limit: number; total: number };

const API_BASE = '';

function actorLabel(item: AuditLogItem) {
  return item.actor.name ?? item.actor.email ?? item.actor.role ?? item.actor.userId;
}

function actorDetail(item: AuditLogItem) {
  if (item.actor.name && item.actor.email) return item.actor.email;
  if (item.actor.name && item.actor.role) return item.actor.role;
  if (!item.actor.name && item.actor.email && item.actor.role) return item.actor.email;
  return '';
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
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;

  const load = useCallback(async () => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (search) params.set('search', search);
      const res = await fetch(`${API_BASE}${apiPath}?${params.toString()}`, {
        credentials: 'include',
        signal: controller.signal,
      });
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
      if (controller.signal.aborted) return;
      setError('Could not reach the API. Please try again.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [apiPath, page, pageSize, search]);

  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setError(null);
    setSearch(value.trim());
    setPage(1);
    setLoading(true);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <Input
          variant="line"
          placeholder="Search by action, actor name, or email"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="max-w-md"
        />
        <div className="hidden items-center rounded-lg border border-primary-200 bg-white p-0.5 sm:flex">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
            title="List view"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-primary-600 text-white'
                : 'text-primary-600 hover:bg-primary-50'
            }`}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="4" y="5" width="16" height="14" rx="1.5" />
              <path strokeLinecap="round" d="M7 9h10M7 12h10M7 15h10" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
            title="Grid view"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-primary-600 text-white'
                : 'text-primary-600 hover:bg-primary-50'
            }`}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="4" y="4" width="6" height="6" rx="1" />
              <rect x="14" y="4" width="6" height="6" rx="1" />
              <rect x="4" y="14" width="6" height="6" rx="1" />
              <rect x="14" y="14" width="6" height="6" rx="1" />
            </svg>
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {loading && logs !== null && (
          <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-6 py-2 text-sm text-neutral-600">
            <Spinner size="sm" label="Searching audit logs..." />
            <span>Searching...</span>
          </div>
        )}
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
            title={search ? 'No matching events' : 'No audit events yet'}
            description={
              search
                ? `Nothing matched "${search}". Try a different name, email, or action.`
                : 'Security and business events will appear here as they happen.'
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className={`${viewMode === 'list' ? 'hidden md:block' : 'hidden'}`}>
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-neutral-500">Action</th>
                    <th className="px-6 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-neutral-500">Actor</th>
                    {showOrganization && (
                      <th className="px-6 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-neutral-500">Organization</th>
                    )}
                    <th className="px-6 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-neutral-500">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {(logs ?? []).map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-neutral-50"
                    >
                      <td className="px-6 py-4 align-middle">
                        <Badge variant="info" size="sm">{log.action}</Badge>
                      </td>
                      <td className="px-6 py-4 align-middle text-sm text-neutral-700">
                        <div>{actorLabel(log)}</div>
                        {actorDetail(log) && (
                          <div className="text-xs text-neutral-500">{actorDetail(log)}</div>
                        )}
                      </td>
                      {showOrganization && (
                        <td className="px-6 py-4 align-middle text-sm text-neutral-500">
                          {log.organization?.name ?? (log.organization?.id ? log.organization.id.slice(0, 8) : '—')}
                        </td>
                      )}
                      <td className="px-6 py-4 align-middle text-sm text-neutral-700">
                        {new Date(log.createdAt).toLocaleString('en-US', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className={`mt-3 grid-cols-1 gap-3 ${viewMode === 'grid' ? 'grid p-3 md:grid-cols-2 lg:grid-cols-3' : 'grid p-3 md:hidden'}`}>
              {(logs ?? []).map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-base font-semibold leading-snug text-neutral-900">
                      {actorLabel(log)}
                    </p>
                  </div>

                  <div className="mt-3">
                    <Badge variant="info" size="sm">{log.action}</Badge>
                  </div>

                  <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
                    {actorDetail(log) && (
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Actor</p>
                        <p className="break-all text-sm text-neutral-700">{actorDetail(log)}</p>
                      </div>
                    )}
                    {showOrganization && (
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Organization</p>
                        <p className="break-all text-sm font-medium text-neutral-900">
                          {log.organization?.name ?? (log.organization?.id ? log.organization.id.slice(0, 8) : '—')}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                    <span>Audit event</span>
                    <span className="text-right">{new Date(log.createdAt).toLocaleString('en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    })}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
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
