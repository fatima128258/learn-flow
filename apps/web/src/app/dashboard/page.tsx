'use client';

import { useEffect, useState } from 'react';
import { LinkButton } from '../../components/ui/LinkButton';
import { AdminSidebar } from '../../components/layout/AdminSidebar';

type DashboardSummary = {
  organizations: { total: number; active: number; suspended: number };
  users: { total: number };
  organizationAdmins: { total: number };
};

type MeResponse = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string;
    role?: string | null;
  };
};

export default function DashboardPage() {
  const [user, setUser] = useState<{ name?: string | null; email?: string } | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const meRes = await fetch('/api/v1/auth/me', { credentials: 'include' });
        if (!meRes.ok) {
          window.location.href = '/login';
          return;
        }

        const meData: MeResponse = await meRes.json();
        if (meData.user?.role !== 'PLATFORM_ADMIN') {
          window.location.href = '/login';
          return;
        }

        const dashRes = await fetch('/api/v1/admin/dashboard', { credentials: 'include' });
        if (!dashRes.ok) {
          window.location.href = '/login';
          return;
        }

        const dashData = await dashRes.json();
        if (!active) return;

        setUser({
          name: meData.user?.name ?? 'Platform Admin',
          email: meData.user?.email ?? 'admin@learnflow.local',
        });
        setSummary(dashData.data ?? null);
      } catch {
        if (active) window.location.href = '/login';
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <AdminSidebar />
        <div className="p-8 lg:pl-72">
          <div className="text-neutral-700">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (!user || !summary) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <AdminSidebar />
        <div className="p-8 lg:pl-72">
          <div className="text-red-600">Access denied.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <AdminSidebar />
      <main className="p-8 lg:pl-72">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Platform Admin</p>
            <h1 className="mt-2 text-3xl font-bold text-neutral-900">Dashboard</h1>
            <div className="mt-4 space-y-1 text-neutral-700">
              <p><span className="font-semibold">Name:</span> {user.name}</p>
              <p><span className="font-semibold">Email:</span> {user.email}</p>
            </div>
            <div className="mt-6">
              <LinkButton href="/dashboard/organizations" variant="outline">
                Manage Organizations
              </LinkButton>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-neutral-500">Total organizations</p>
              <p className="mt-3 text-3xl font-bold text-neutral-900">{summary.organizations.total}</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-neutral-500">Active organizations</p>
              <p className="mt-3 text-3xl font-bold text-emerald-600">{summary.organizations.active}</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-neutral-500">Suspended organizations</p>
              <p className="mt-3 text-3xl font-bold text-red-600">{summary.organizations.suspended}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
