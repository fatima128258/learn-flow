'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export interface AdminSidebarItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const DashboardIcon: React.FC = () => (
  <svg
    className="h-5 w-5 flex-shrink-0"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"
    />
  </svg>
);

const OrganizationsIcon: React.FC = () => (
  <svg
    className="h-5 w-5 flex-shrink-0"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H3m4-12h4m-4 4h4m-4 4h4m4-8h2m-2 4h2m-2 4h2"
    />
  </svg>
);

const navItems: AdminSidebarItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { href: '/dashboard/organizations', label: 'Organizations', icon: <OrganizationsIcon /> },
];

function getActiveItem(pathname: string | null): AdminSidebarItem | null {
  if (!pathname) return null;
  const matches = navItems.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  if (matches.length === 0) return null;
  return matches.reduce((best, item) => (item.href.length > best.href.length ? item : best));
}

export const AdminSidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const activeItem = getActiveItem(pathname);

  async function handleLogout() {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      await fetch(`${apiBase}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    window.location.href = '/login';
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-neutral-200 bg-white lg:flex">
      <div className="flex h-16 items-center border-b border-neutral-200 px-6">
        <Link href="/" className="flex items-center space-x-2" aria-label="LearnFlow Home">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary-600 to-primary-800 shadow-sm">
            <span className="text-lg font-bold text-white">L</span>
          </span>
          <span className="text-lg font-bold text-neutral-900">LearnFlow</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6" aria-label="Platform Admin">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Platform Admin
        </p>
        {navItems.map((item) => {
          const isActive = activeItem?.href === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-primary-50 font-semibold text-primary-700'
                  : 'font-medium text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-neutral-200 px-4 py-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
        >
          <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
          </svg>
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
};

AdminSidebar.displayName = 'AdminSidebar';
