'use client';

import { useEffect, useRef, useState } from 'react';
import type { CurrentUser } from '@/lib/types';

function displayName(user: CurrentUser) {
  return user.name?.trim() || user.email;
}

function roleLabel(role: CurrentUser['role']) {
  if (role === 'STUDENT') return 'Student';
  if (role === 'INSTRUCTOR') return 'Instructor';
  if (role === 'ORG_ADMIN') return 'Organization Admin';
  if (role === 'PLATFORM_ADMIN') return 'Platform Admin';
  return 'User';
}

export function ProfileAvatarMenu({ user }: { user: CurrentUser | null | undefined }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  if (!user) return null;

  const name = displayName(user);
  const initial = name.charAt(0).toUpperCase() || '?';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Open profile menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Profile information"
          className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">{initial}</span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-neutral-900">{name}</p>
              <p className="text-sm text-neutral-500">{roleLabel(user.role)}</p>
            </div>
          </div>
          <div className="mt-3 border-t border-neutral-100 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Organization</p>
            <p className="mt-1 truncate text-sm text-neutral-700">{user.organizationName || 'No organization assigned'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
