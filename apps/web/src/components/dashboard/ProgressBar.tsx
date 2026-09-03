import React from 'react';

export type ProgressTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export interface ProgressBarProps {
  /** 0–100 clamp handled internally */
  value: number;
  tone?: ProgressTone;
  className?: string;
}

const toneClasses: Record<ProgressTone, string> = {
  primary: 'bg-primary-600',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-error-500',
  neutral: 'bg-neutral-500',
};

/**
 * Thin rounded progress bar used across dashboards (course progress, module
 * completion, per-status shares) — one visual language everywhere.
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({ value, tone = 'primary', className = '' }) => {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-neutral-100 ${className}`.trim()}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${toneClasses[tone]}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};

ProgressBar.displayName = 'ProgressBar';
