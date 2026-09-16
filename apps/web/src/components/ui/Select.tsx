'use client';

import React, { useEffect, useId, useRef, useState } from 'react';

export type SelectOption = {
  value: string;
  label: string;
};

export interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  'aria-label'?: string;
  className?: string;
  menuClassName?: string;
}

export const Select: React.FC<SelectProps> = ({
  value,
  options,
  onChange,
  disabled = false,
  label,
  'aria-label': ariaLabel,
  className = '',
  menuClassName = '',
}) => {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex] ?? options[0];

  useEffect(() => {
    setHighlightedIndex(Math.max(0, selectedIndex));
  }, [selectedIndex]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setHighlightedIndex(index);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlightedIndex((current) => (current + delta + options.length) % options.length);
    } else if (event.key === 'Home' && open) {
      event.preventDefault();
      setHighlightedIndex(0);
    } else if (event.key === 'End' && open) {
      event.preventDefault();
      setHighlightedIndex(Math.max(0, options.length - 1));
    } else if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault();
      choose(highlightedIndex);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      {label && <label className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</label>}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled || options.length === 0}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className="flex w-full items-center justify-between rounded-md border border-neutral-300 bg-[#fffdf9] px-3 py-2 text-left text-neutral-900 outline-none transition-colors focus:border-[#7a4a2e] focus:ring-2 focus:ring-[#a8784f]/20 disabled:cursor-not-allowed disabled:bg-[#f8f2eb] disabled:text-neutral-400"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
      >
        <span className="truncate">{selected?.label ?? 'Select an option'}</span>
        <svg className={`ml-3 h-4 w-4 flex-shrink-0 text-[#7a4a2e] transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul id={listboxId} role="listbox" aria-label={ariaLabel ?? label} className={`absolute left-0 right-0 z-[120] mt-1 max-h-60 overflow-y-auto rounded-md border border-[#ead8c6] bg-[#fffdf9] py-1 shadow-lg ${menuClassName}`.trim()}>
          {options.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={`cursor-pointer px-3 py-2 text-sm transition-colors ${index === highlightedIndex ? 'bg-[#f5ebdd] text-[#5a321f]' : 'text-[#17212b] hover:bg-[#fcf3e8]'} ${option.value === value ? 'font-semibold' : ''}`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

Select.displayName = 'Select';
