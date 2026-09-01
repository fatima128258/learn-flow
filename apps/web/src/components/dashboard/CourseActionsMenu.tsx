'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface CourseActionsMenuProps {
  courseId: string;
  manageHref: string;
  onChangeStatusClick: () => void;
}

export function CourseActionsMenu({
  manageHref,
  onChangeStatusClick,
}: CourseActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Recalculate position every time menu opens
  function openMenu() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuWidth = 208; // w-52 = 13rem = 208px
    const menuHeight = 90; // approx height of 2 items

    const top =
      rect.bottom + menuHeight > window.innerHeight
        ? rect.top - menuHeight - 4  // open upward
        : rect.bottom + 4;           // open downward

    const left =
      rect.right - menuWidth < 0
        ? rect.left                  // align left if near left edge
        : rect.right - menuWidth;    // align right edge with button

    setCoords({ top, left });
    setOpen(true);
  }

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    function handleScroll() {
      setOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  const menu = open ? (
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 9999 }}
      className="w-52 rounded-xl border border-neutral-200 bg-white py-1 shadow-xl ring-1 ring-black/5"
    >
      {/* Manage */}
      <a
        href={manageHref}
        onClick={() => setOpen(false)}
        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
      >
        <svg className="h-4 w-4 shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Manage
      </a>

      <div className="mx-3 border-t border-neutral-100" />

      {/* Change Status */}
      <button
        type="button"
        onClick={() => { setOpen(false); onChangeStatusClick(); }}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
      >
        <svg className="h-4 w-4 shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Change Status
      </button>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openMenu}
        className="inline-flex items-center justify-center rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-label="Course actions"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5"  r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {/* Portal — renders outside all overflow containers, directly on body */}
      {typeof document !== 'undefined' && menu
        ? createPortal(menu, document.body)
        : null}
    </>
  );
}
