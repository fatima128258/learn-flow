import React from 'react';
import { SectionHeader } from './SectionHeader';

export interface ChartCardProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Card shell with heading used for any chart, analytics, or data-viz block so
 * every dashboard presents analytics in the same visual language.
 */
export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  description,
  action,
  children,
  className = '',
}) => {
  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm ${className}`.trim()}>
      <SectionHeader title={title} description={description} action={action} className="mb-4" />
      {children}
    </div>
  );
};

ChartCard.displayName = 'ChartCard';

export interface BarDatum {
  label: string;
  value: number;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
}

const barTones: Record<NonNullable<BarDatum['tone']>, string> = {
  primary: 'bg-primary-600',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-error-500',
  neutral: 'bg-neutral-400',
};

/**
 * Dependency-free horizontal bar list (e.g. "courses by status") rendered from
 * real data. Pure CSS bars, no chart library required.
 */
export const BarList: React.FC<{ data: BarDatum[]; className?: string }> = ({
  data,
  className = '',
}) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className={`space-y-3 ${className}`.trim()}>
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-neutral-700">{d.label}</span>
            <span className="font-semibold text-neutral-900">{d.value}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className={`h-full rounded-full ${barTones[d.tone ?? 'primary']}`}
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
};

BarList.displayName = 'BarList';