'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, EmptyState, EmptyStateIcons, ErrorState, Spinner } from '@/components/ui';
import { PageHeader } from '@/components/dashboard';
import { useCurrentUser } from '@/features/auth/useCurrentUser';

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
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [notifications, setNotifications] = useState<NotificationDto[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  async function loadNotifications(orgId: string) {
    setNotificationsLoading(true);
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
    } finally {
      setNotificationsLoading(false);
    }
  }

  // Check auth and set organizationId
  useEffect(() => {
    if (userLoading) return;
    
    if (!user) {
      window.location.href = '/login';
      return;
    }
    
    if (user.role !== 'STUDENT') {
      window.location.href = '/login';
      return;
    }
    
    const orgId = user.organizationId ?? null;
    if (!orgId) {
      window.location.href = '/login';
      return;
    }
    
    setOrganizationId(orgId);
  }, [user, userLoading]);

  // Load notifications once organizationId is set
  useEffect(() => {
    if (!organizationId) return;
    let active = true;

    const load = async () => {
      setNotificationsLoading(true);
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const res = await fetch(`${apiBase}/api/v1/organizations/${organizationId}/student/notifications`, {
          credentials: 'include',
        });
        if (!active) return;
        if (!res.ok) {
          setError('Could not load your notifications. Please try again.');
          return;
        }
        const body = await res.json();
        if (!active) return;
        setNotifications(body.data?.notifications ?? []);
        setUnreadCount(body.data?.unreadCount ?? 0);
      } catch {
        if (active) setError('Could not reach the server. Please try again.');
      } finally {
        if (active) setNotificationsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [organizationId]);

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

  if (userLoading || notificationsLoading) {
    return (
      <div className="mx-auto flex max-w-3xl items-center gap-3 text-neutral-700">
        <Spinner size="lg" label="Loading notifications..." />
        <span>Loading notifications...</span>
      </div>
    );
  }

  const hasUnread = notifications?.some((n) => !n.read) ?? false;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        subtitle="Inbox"
        title="Notifications"
          description={unreadCount > 0 ? `${unreadCount} unread` : undefined}
          breadcrumbs={
            <div className="flex items-center gap-2 text-sm">
              <Link href="/dashboard/student" className="text-primary-600 hover:text-primary-700">My Courses</Link>
              <span className="text-neutral-400">/</span>
              <span className="text-neutral-600">Notifications</span>
            </div>
          }
          actions={
            hasUnread ? (
              <button
                onClick={markAllAsRead}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
              >
                Mark all as read
              </button>
            ) : undefined
          }
        />

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
  );
}
