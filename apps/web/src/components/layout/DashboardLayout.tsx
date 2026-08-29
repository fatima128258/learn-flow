'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '../../lib/api';
import { SkipLink } from './SkipLink';

export interface NavItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
}

export interface DashboardLayoutProps {
  navLabel: string;
  items: NavItem[];
  children: React.ReactNode;
  contentClassName?: string;
}

const DashboardIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
  </svg>
);

const OrganizationsIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H3m4-12h4m-4 4h4m-4 4h4m4-8h2m-2 4h2m-2 4h2" />
  </svg>
);

const UsersIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const CoursesIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5-1.253" />
  </svg>
);

const AuditIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const MetricsIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const SettingsIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ProfileIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

export const NavIcons = {
  dashboard: <DashboardIcon />,
  organizations: <OrganizationsIcon />,
  users: <UsersIcon />,
  courses: <CoursesIcon />,
  audit: <AuditIcon />,
  metrics: <MetricsIcon />,
  settings: <SettingsIcon />,
  profile: <ProfileIcon />,
};

function getActiveItem(pathname: string, items: NavItem[]): string | null {
  const matches = items.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (matches.length === 0) return null;
  return matches.reduce((best, item) => (item.href.length > best.href.length ? item : best)).href;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  navLabel,
  items,
  children,
  contentClassName = 'p-8',
}) => {
  const pathname = usePathname();
  const activeHref = getActiveItem(pathname ?? '', items);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      closeButtonRef.current?.focus();
    }
  }, [mobileOpen]);

  const handleLogout = useCallback(() => {
    void logout();
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  const navLinks = (navClassName: string, linkClassName: (isActive: boolean) => string) =>
    items.map((item) => {
      const isActive = activeHref === item.href;
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive ? 'page' : undefined}
          className={`${navClassName} ${linkClassName(isActive)}`}
        >
          {item.icon}
          <span>{item.label}</span>
        </Link>
      );
    });

  const brand = (
    <Link href="/" className="flex items-center space-x-2" aria-label="LearnFlow Home">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary-600 to-primary-800 shadow-sm">
        <span className="text-lg font-bold text-white">L</span>
      </span>
      <span className="text-lg font-bold text-neutral-900">LearnFlow</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-neutral-50">
      <SkipLink />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-neutral-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-neutral-200 px-6">{brand}</div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6" aria-label={navLabel}>
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {navLabel}
          </p>
          {navLinks(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            (isActive) =>
              isActive
                ? 'bg-primary-50 font-semibold text-primary-700'
                : 'font-medium text-neutral-600 hover:bg-neutral-100',
          )}
        </nav>
        <div className="border-t border-neutral-200 px-4 py-4">
          <Link
            href="/dashboard/profile"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
          >
            <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>My Profile</span>
          </Link>
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

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={navLabel}>
          <button
            type="button"
            className="absolute inset-0 bg-neutral-900/50 focus:outline-none"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation overlay"
            tabIndex={-1}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-neutral-200 px-6">
              {brand}
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Close navigation"
              >
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6" aria-label={`${navLabel} (mobile)`}>
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {navLabel}
              </p>
              {navLinks(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                (isActive) =>
                  isActive
                    ? 'bg-primary-50 font-semibold text-primary-700'
                    : 'font-medium text-neutral-600 hover:bg-neutral-100',
              )}
            </nav>
            <div className="border-t border-neutral-200 px-4 py-4">
              <Link
                href="/dashboard/profile"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
              >
                <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>My Profile</span>
              </Link>
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
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-neutral-700 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
        >
          <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      <main id="main-content" tabIndex={-1} className={`lg:pl-72 ${contentClassName}`}>
        {children}
      </main>
    </div>
  );
};

DashboardLayout.displayName = 'DashboardLayout';