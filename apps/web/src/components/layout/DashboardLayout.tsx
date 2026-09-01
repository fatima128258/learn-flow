'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '../../lib/api';
import { SkipLink } from './SkipLink';
import { LearnFlowLogo } from '../public/LearnFlowLogo';
import { ButtonSpinner } from '../ui/Spinner';
import { useCurrentUser } from '../../features/auth/useCurrentUser';

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
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
  </svg>
);

const OrganizationsIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H3m4-12h4m-4 4h4m-4 4h4m4-8h2m-2 4h2m-2 4h2" />
  </svg>
);

const UsersIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const CoursesIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const AuditIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const MetricsIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const SearchIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const NotificationsIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const CertificateIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const SettingsIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ProfileIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const LogoutIcon: React.FC = () => (
  <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
  </svg>
);

/**
 * Panel/sidebar collapse icon that matches the screenshot style: [«] when expanded, [»] when collapsed.
 * Outer bracket rectangle + inner double-chevron arrows.
 */
const PanelCollapseIcon: React.FC<{ collapsed: boolean }> = ({ collapsed }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className="flex-shrink-0"
  >
    {/* Outer rounded rectangle — the "panel" border */}
    <rect x="1.5" y="1.5" width="17" height="17" rx="3" stroke="currentColor" strokeWidth="1.5" />
    {/* Left panel divider — the sidebar split line */}
    <line x1="6.5" y1="1.5" x2="6.5" y2="18.5" stroke="currentColor" strokeWidth="1.5" />
    {/* Double-chevron arrow — points left (collapse) or right (expand) */}
    {collapsed ? (
      /* [»] — two chevrons pointing right */
      <>
        <path d="M10 7l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 7l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ) : (
      /* [«] — two chevrons pointing left */
      <>
        <path d="M13 7l-3 3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 7l-3 3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    )}
  </svg>
);

export const NavIcons = {
  dashboard: <DashboardIcon />,
  organizations: <OrganizationsIcon />,
  users: <UsersIcon />,
  courses: <CoursesIcon />,
  audit: <AuditIcon />,
  metrics: <MetricsIcon />,
  search: <SearchIcon />,
  notifications: <NotificationsIcon />,
  certificates: <CertificateIcon />,
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

function NavLink({
  item,
  isActive,
  collapsed,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`group relative flex w-full items-center rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
        collapsed ? 'justify-center gap-0' : 'gap-3'
      } ${
        isActive
          ? 'bg-primary-50 font-semibold text-primary-700'
          : 'font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
      }`}
    >
      {isActive && (
        <span
          className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary-600"
          aria-hidden="true"
        />
      )}
      {item.icon}
      {!collapsed && <span className="truncate">{item.label}</span>}

      {/* Tooltip — only visible when collapsed */}
      {collapsed && (
        <span
          className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
          role="tooltip"
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}

const STORAGE_KEY = 'dashboard-sidebar-collapsed';

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  navLabel,
  items,
  children,
  contentClassName = 'p-4 sm:p-6 lg:p-8',
}) => {
  const pathname = usePathname();
  const activeHref = getActiveItem(pathname ?? '', items);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const logoutInFlight = useRef(false);

  // Restore collapsed state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') {
        // Use a timeout to avoid synchronous setState in effect
        setTimeout(() => setCollapsed(true), 0);
      }
    } catch {
      // localStorage not available — ignore
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      closeButtonRef.current?.focus();
    }
  }, [mobileOpen]);

  const handleLogout = useCallback(async () => {
    if (logoutInFlight.current) return;
    logoutInFlight.current = true;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      logoutInFlight.current = false;
      setLoggingOut(false);
    }
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  const pageLabel = items.find((item) => item.href === activeHref)?.label ?? 'Dashboard';
  const { data: currentUser } = useCurrentUser();

  // ── Desktop nav ────────────────────────────────────────────────────────────
  const desktopNav = (
    <nav
      className="flex-1 overflow-y-auto overflow-x-hidden"
      style={{ padding: collapsed ? '12px 8px' : '12px 12px' }}
      aria-label={navLabel}
    >
      <div className={`w-full space-y-1 ${collapsed ? 'flex flex-col items-center' : ''}`}>
        {items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={activeHref === item.href}
            collapsed={collapsed}
          />
        ))}
      </div>
    </nav>
  );

  // ── Mobile nav (always expanded) ───────────────────────────────────────────
  const mobileNav = (onNavigate?: () => void) => (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 pt-2" aria-label={navLabel}>
      {items.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          isActive={activeHref === item.href}
          collapsed={false}
          onClick={onNavigate}
        />
      ))}
    </nav>
  );

  // ── Sidebar footer ─────────────────────────────────────────────────────────
  const sidebarFooter = (isCollapsed: boolean) => (
    <div className={`border-t border-neutral-200 py-3 ${isCollapsed ? 'px-2' : 'px-3'}`}>
      {/* Logout button */}
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        aria-busy={loggingOut}
        title={isCollapsed ? (loggingOut ? 'Logging out…' : 'Log out') : undefined}
        className={`group relative flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-60 ${
          isCollapsed ? 'justify-center' : 'gap-3'
        }`}
      >
        {loggingOut ? <ButtonSpinner /> : <LogoutIcon />}
        {!isCollapsed && <span>{loggingOut ? 'Logging out...' : 'Log out'}</span>}
        {isCollapsed && (
          <span
            className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
            role="tooltip"
          >
            {loggingOut ? 'Logging out…' : 'Log out'}
          </span>
        )}
      </button>


    </div>
  );

  const brand = <LearnFlowLogo href={undefined} size={30} />;

  // Sidebar width values
  const sidebarW = collapsed ? 'w-16' : 'w-52';
  const contentPl = collapsed ? 'lg:pl-16' : 'lg:pl-52';

  return (
    <div className="min-h-screen bg-background-alt">
      <SkipLink />

      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-neutral-200 bg-white transition-all duration-200 overflow-hidden lg:flex ${sidebarW}`}
      >
        {/* Header */}
        <div
          className={`flex h-16 items-center border-b border-neutral-200 ${
            collapsed ? 'justify-center px-2' : 'px-6'
          }`}
        >
          {collapsed ? <LearnFlowLogo href={undefined} size={28} withText={false} /> : brand}
        </div>

        {desktopNav}
        {sidebarFooter(collapsed)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={navLabel}
        >
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
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            {mobileNav(() => setMobileOpen(false))}
            {/* Mobile footer — never collapsed */}
            <div className="border-t border-neutral-200 px-3 py-4">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                aria-busy={loggingOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loggingOut ? <ButtonSpinner /> : <LogoutIcon />}
                <span>{loggingOut ? 'Logging out...' : 'Log out'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-200 bg-white/90 px-4 backdrop-blur lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-neutral-700 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
        >
          <svg
            className="h-6 w-6"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </header>

      {/* Content column — shifts with sidebar */}
      <div className={`transition-all duration-200 ${contentPl}`}>
        {/* Desktop page header strip */}
        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-neutral-200 bg-white/80 px-6 backdrop-blur lg:flex">
          <div className="flex items-center gap-3">
            {/* Panel collapse toggle — [«] / [»] icon, matches screenshot */}
            <button
              type="button"
              onClick={toggleCollapsed}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none"
            >
              <PanelCollapseIcon collapsed={collapsed} />
            </button>
            <span className="text-base font-semibold text-neutral-900">{pageLabel}</span>
          </div>
          {currentUser?.name && (
            <p className="text-sm font-medium text-neutral-500">
              Welcome, <span className="text-neutral-900">{currentUser.name}</span>
            </p>
          )}
        </header>

        <main id="main-content" tabIndex={-1} className={`${contentClassName}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

DashboardLayout.displayName = 'DashboardLayout';
