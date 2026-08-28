'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, EmptyState, EmptyStateIcons, ErrorState, Spinner } from '@/components/ui';

type MeResponse = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string;
    role?: string | null;
    organizationId?: string | null;
  };
};

type NotificationDto = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  data?: unknown;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
};

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export default function StudentNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationDto[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const meRes = await fetch(`${apiBase}/api/v1/auth/me`, { credentials: 'include' });
        if (!active) return;
        if (!meRes.ok) {
          window.location.href = '/login';
          return;
        }
        const meData: MeResponse = await meRes.json();
        if (!active) return;
        if (meData.user?.role !== 'STUDENT') {
          window.location.href = '/login';
          return;
        }
        const orgId = meData.user?.organizationId ?? null;
        if (!orgId) {
          window.location.href = '/login';
          return;
        }
        setOrganizationId(orgId);
        await loadNotifications(orgId);
      } catch {
        if (active) window.location.href = '/login';
      } finally {
        if (active) setLoading(false);
      }
    }

    init();
    return () => {
      active = false;
    };
  }, []);

  async function loadNotifications(orgId: string) {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/v1/organizations/${orgId}/student/notifications`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setError('Could not load your notifications. Please try again.');
        return;
      }
      const body = await res.json();
      setNotifications(body.data?.notifications ?? []);
      setUnreadCount(body.data?.unreadCount ?? 0);
    } catch {
      setError('Could not reach the server. Please try again.');
    }
  }

  async function markAsRead(id: string) {
    if (!organizationId) return;
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/student/notifications/${id}/read`,
        { method: 'POST', credentials: 'include' },
      );
      if (res.ok) {
        setNotifications((prev) =>
          (prev ?? []).map((n) => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n)),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      // ignore per-item failures
    }
  }

  async function markAllAsRead() {
    if (!organizationId) return;
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/student/notifications/read-all`,
        { method: 'POST', credentials: 'include' },
      );
      if (res.ok) {
        setNotifications((prev) =>
          (prev ?? []).map((n) => ({ ...n, read: true, readAt: n.readAt ?? new Date().toISOString() })),
        );
        setUnreadCount(0);
      }
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto flex max-w-3xl items-center gap-3 text-neutral-700">
          <Spinner size="lg" label="Loading notifications..." />
          <span>Loading notifications...</span>
        </div>
      </main>
    );
  }

  const hasUnread = notifications?.some((n) => !n.read) ?? false;

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center gap-2 text-sm">
          <Link href="/dashboard/student" className="text-primary-600 hover:text-primary-700">My Courses</Link>
          <span className="text-neutral-400">/</span>
          <span className="text-neutral-600">Notifications</span>
        </div>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Inbox</p>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900">Notifications</h1>
            {unreadCount > 0 && (
              <p className="mt-1 text-sm text-neutral-600">{unreadCount} unread</p>
            )}
          </div>
          {hasUnread && (
            <button
              onClick={markAllAsRead}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
            >
              Mark all as read
            </button>
          )}
        </div>

        {error ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState
              title="Unable to load notifications"
              message={error}
              action={organizationId ? { label: 'Retry', onClick: () => loadNotifications(organizationId!) } : undefined}
            />
          </div>
        ) : notifications && notifications.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <EmptyState
              icon={EmptyStateIcons.NoNotifications}
              title="No notifications"
              description="When something happens — like course enrollment, completion, or a certificate being generated — you will see it here."
            />
          </div>
        ) : notifications ? (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm ${
                  n.read ? 'border-neutral-200' : 'border-primary-200 bg-primary-50/30'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {!n.read && <Badge variant="primary" size="sm">New</Badge>}
                    {n.read && <span className="text-xs text-neutral-400">Read</span>}
                    <span className="text-xs text-neutral-400">{formatDate(n.createdAt)}</span>
                  </div>
                  {!n.read && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      className="text-xs font-medium text-primary-600 hover:text-primary-700"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
                <h2 className={`text-base ${n.read ? 'font-semibold text-neutral-700' : 'font-bold text-neutral-900'}`}>
                  {n.title}
                </h2>
                {n.body && <p className="mt-1 text-sm text-neutral-600">{n.body}</p>}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
