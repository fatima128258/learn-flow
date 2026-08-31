'use client';

import { useState } from 'react';

type CalendarProps = {
  className?: string;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function Calendar({ className = '' }: CalendarProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const goToPreviousMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  const goToToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const isToday = (day: number | null): boolean =>
    !!day &&
    day === today.getDate() &&
    currentMonth === today.getMonth() &&
    currentYear === today.getFullYear();

  return (
    <div className={`w-full rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
        <h3 className="text-base font-semibold text-neutral-900">
          {MONTHS[currentMonth]} {currentYear}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={goToToday}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 focus:outline-none"
            type="button"
          >
            Today
          </button>
          <button
            onClick={goToPreviousMonth}
            className="rounded-lg p-1 text-neutral-500 transition-colors hover:bg-neutral-100 focus:outline-none"
            type="button"
            aria-label="Previous month"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToNextMonth}
            className="rounded-lg p-1 text-neutral-500 transition-colors hover:bg-neutral-100 focus:outline-none"
            type="button"
            aria-label="Next month"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-5 py-3">
        {/* Day name headers */}
        <div className="mb-1 grid grid-cols-7">
          {DAYS.map((day) => (
            <div key={day} className="py-1 text-center text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {day}
            </div>
          ))}
        </div>

        {/* Divider under day headers */}
        <div className="mb-2 border-t border-neutral-100" />

        {/* Day cells grid */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => (
            <div
              key={index}
              className={`
                flex h-9 items-center justify-center rounded-lg text-sm font-medium transition-colors
                ${day === null ? '' : 'cursor-default hover:bg-neutral-50'}
                ${isToday(day)
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : day !== null
                    ? 'text-neutral-700'
                    : ''}
              `}
            >
              {day ?? ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
