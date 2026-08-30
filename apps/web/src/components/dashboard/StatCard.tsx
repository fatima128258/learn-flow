import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export type StatTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: StatTone;
  className?: string;
}

const chipTones: Record<StatTone, string> = {
  primary: 'bg-primary-50 text-primary-600',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-600',
  danger: 'bg-error-50 text-error-600',
  info: 'bg-blue-50 text-blue-600',
  neutral: 'bg-neutral-100 text-neutral-600',
};

const valueTones: Record<StatTone, string> = {
  primary: 'text-primary-700',
  success: 'text-success-600',
  warning: 'text-warning-600',
  danger: 'text-error-600',
  info: 'text-blue-600',
  neutral: 'text-neutral-900',
};

/**
 * Uniform stat/metric card shared by every role dashboard (student, instructor,
 * admin, org admin). The data passed in is always role-specific.
 */
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  className = '',
}) => {
  return (
    <div
      className={`rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-500">{label}</p>
          <p className={`mt-2 text-3xl font-bold tracking-tight ${valueTones[tone]}`}>{value}</p>
          {hint && <p className="mt-2 text-xs text-neutral-500">{hint}</p>}
        </div>
        {icon && (
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${chipTones[tone]}`}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>
    </div>
  );
};

StatCard.displayName = 'StatCard';

export const StatCardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm ${className}`.trim()}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="w-full">
        <Skeleton variant="text" height={12} className="w-1/2" />
        <Skeleton variant="text" height={28} className="mt-3 w-16" />
        <Skeleton variant="text" height={12} className="mt-2 w-2/3" />
      </div>
      <Skeleton variant="rectangular" className="h-11 w-11 shrink-0 rounded-xl" />
    </div>
  </div>
);

StatCardSkeleton.displayName = 'StatCardSkeleton';