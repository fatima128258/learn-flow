'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Drawer,
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

// Keys whose values must never be exposed to the UI.
const SENSITIVE_KEYS = [
  'password',
  'passwordHash',
  'passwords',
  'hash',
  'token',
  'accessToken',
  'refreshToken',
  'authToken',
  'secret',
  'apiKey',
  'apiSecret',
  'authorization',
  'cookie',
  'sessionId',
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    SENSITIVE_KEYS.some((k) => lower === k || lower.includes(k)) ||
    lower.includes('password') ||
    lower.includes('token') ||
    lower.includes('secret')
  );
}

function redactJson(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(redactJson);
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        out[key] = '••••••••';
      } else {
        out[key] = redactJson(value);
      }
    }
    return out;
  }
  return input;
}

function formatMetadata(metadata: Record<string, unknown> | null) {
  if (metadata === null || metadata === undefined) return null;
  const safe = redactJson(metadata);
  return JSON.stringify(safe, null, 2);
}

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <div className="mt-1 text-sm text-neutral-700">{children}</div>
    </div>
  );
}

interface AuditLogDrawerProps {
  item: AuditLogItem;
  onClose: () => void;
}

function AuditLogDrawer({ item, onClose }: AuditLogDrawerProps) {
  const metadataFormatted = formatMetadata(item.metadata);

  return (
    <Drawer
      isOpen={Boolean(item)}
      onClose={onClose}
      title={item.action}
    >
      <div className="space-y-5">
        {/* Action */}
        <DetailRow label="Action">
          <Badge variant="info" size="sm">{item.action}</Badge>
        </DetailRow>

        {/* Actor */}
        <DetailRow label="Actor">
          <div className="space-y-0.5">
            {item.actor.name && <p className="font-medium text-neutral-900">{item.actor.name}</p>}
            {item.actor.email && <p className="break-all">{item.actor.email}</p>}
            {item.actor.role && <p className="text-xs text-neutral-500">{item.actor.role}</p>}
            {item.actor.userId && (
              <p className="break-all text-xs text-neutral-400">ID: {item.actor.userId}</p>
            )}
          </div>
        </DetailRow>

        {/* Organization */}
        <DetailRow label="Organization">
          {item.organization?.id ? (
            <div className="space-y-0.5">
              {item.organization.name && <p className="font-medium text-neutral-900">{item.organization.name}</p>}
              <p className="break-all text-xs text-neutral-400">ID: {item.organization.id}</p>
            </div>
          ) : (
            <p className="text-neutral-400">—</p>
          )}
        </DetailRow>

        
        <DetailRow label="Timestamp">
          {formatTimestamp(item.createdAt)}
        </DetailRow>

        {/* IP address */}
        {item.ipAddress && (
          <DetailRow label="IP Address">
            {item.ipAddress}
          </DetailRow>
        )}

        {/* Metadata / Details */}
        {metadataFormatted ? (
          <DetailRow label="Details">
            <pre className="max-h-72 overflow-auto rounded-lg bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-700">
              {metadataFormatted}
            </pre>
          </DetailRow>
        ) : (
          <DetailRow label="Details">
            <p className="text-neutral-400">No additional details.</p>
          </DetailRow>
        )}
      </div>
    </Drawer>
  );
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditLogItem | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (search) params.set('search', search);
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
  }, [apiPath, page, pageSize, search]);

  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value.trim());
      setPage(1);
      setLoading(true);
    }, 300);
  };

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const openItem = (item: AuditLogItem) => setSelected(item);
  const closeItem = () => setSelected(null);

  return (
    <div>
      <div className="mb-4">
        <Input
          variant="line"
          placeholder="Search by action, actor name, or email"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
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
            <div className="hidden md:block">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Actor</th>
                    {showOrganization && (
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Organization</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {(logs ?? []).map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => openItem(log)}
                      className="cursor-pointer hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openItem(log);
                        }
                      }}
                    >
                      <td className="px-6 py-4">
                        <Badge variant="info" size="sm">{log.action}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-700">
                        <div>{actorLabel(log)}</div>
                        {actorDetail(log) && (
                          <div className="text-xs text-neutral-500">{actorDetail(log)}</div>
                        )}
                      </td>
                      {showOrganization && (
                        <td className="px-6 py-4 text-sm text-neutral-500">
                          {log.organization?.name ?? (log.organization?.id ? log.organization.id.slice(0, 8) : '—')}
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-neutral-700">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="space-y-3 p-3 md:hidden">
              {(logs ?? []).map((log) => (
                <div
                  key={log.id}
                  onClick={() => openItem(log)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openItem(log);
                    }
                  }}
                  className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm cursor-pointer hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="info" size="sm">{log.action}</Badge>
                    <span className="text-xs text-neutral-400">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Actor</p>
                      <p className="text-sm text-neutral-700 break-all">{actorLabel(log)}</p>
                      {actorDetail(log) && (
                        <p className="text-xs text-neutral-500 break-all">{actorDetail(log)}</p>
                      )}
                    </div>
                    {showOrganization && (log.organization?.id || log.organization?.name) && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Organization</p>
                        <p className="text-sm text-neutral-500">{log.organization?.name ?? log.organization?.id?.slice(0, 8)}</p>
                      </div>
                    )}
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

      {selected && <AuditLogDrawer item={selected} onClose={closeItem} />}
    </div>
  );
};

AuditLogTable.displayName = 'AuditLogTable';
