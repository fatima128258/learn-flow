'use client';

import React, { useEffect, useRef, useState } from 'react';

export type DataViewMode = 'table' | 'cards';

interface ViewToggleProps {
  value: DataViewMode;
  onChange: (value: DataViewMode) => void;
  storageKey?: string;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({ value, onChange, storageKey }) => {
  const [hydrated, setHydrated] = useState(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (storageKey) {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === 'table' || stored === 'cards') onChangeRef.current(stored);
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (hydrated && storageKey) window.localStorage.setItem(storageKey, value);
  }, [hydrated, storageKey, value]);

  useEffect(() => {
    if (!hydrated) return;

    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const updateForViewport = () => {
      if (mediaQuery.matches) onChangeRef.current('cards');
    };

    updateForViewport();
    mediaQuery.addEventListener('change', updateForViewport);
    return () => mediaQuery.removeEventListener('change', updateForViewport);
  }, [hydrated]);

  const buttonClass = (mode: DataViewMode) =>
    `inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-200 ${
      value === mode
        ? 'bg-[#5a321f] text-white'
        : 'text-[#7a4a2e] hover:bg-[#f5ebdd]'
    }`;

  return (
    <div className="hidden items-center rounded-lg border border-[#ead8c6] bg-[#fffdf9] p-0.5 sm:flex" role="group" aria-label="Change data view">
      <button type="button" className={buttonClass('table')} onClick={() => onChange('table')} aria-label="Table view" aria-pressed={value === 'table'} title="Table view">
        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="4" y="5" width="16" height="14" rx="1.5" />
          <path strokeLinecap="round" d="M4 10h16M4 14h16M9 5v14" />
        </svg>
      </button>
      <button type="button" className={buttonClass('cards')} onClick={() => onChange('cards')} aria-label="Card view" aria-pressed={value === 'cards'} title="Card view">
        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
      </button>
    </div>
  );
};

ViewToggle.displayName = 'ViewToggle';
