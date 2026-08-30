import React from 'react';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

const sizeStyles: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '', label = 'Loading...' }) => {
  return (
    <div className="inline-flex items-center" role="status">
      <svg
        className={`animate-spin text-primary-600 ${sizeStyles[size]} ${className}`.trim()}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
};

Spinner.displayName = 'Spinner';

/**
 * Inline spinner used inside buttons/actions while a request is pending.
 * Ships the same markup the site's specs rely on (`svg.animate-spin`).
 */
export const ButtonSpinner: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    className={`animate-spin -ml-1 mr-2 h-4 w-4 ${className}`.trim()}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

ButtonSpinner.displayName = 'ButtonSpinner';

/** Centered page-level loader for route/async data loading. */
export const PageLoader: React.FC<{ label?: string; className?: string; compact?: boolean }> = ({
  label = 'Loading...',
  className = '',
  compact = false,
}) => (
  <div className={`flex w-full items-center justify-center py-16 ${compact ? 'min-h-0' : 'min-h-[50vh]'} ${className}`.trim()} role="status">
    <div className="flex flex-col items-center gap-3">
      <Spinner size="lg" label={label} />
      <span className="text-sm font-medium text-neutral-500">{label}</span>
    </div>
  </div>
);

PageLoader.displayName = 'PageLoader';

/** Inline spinner + text for small async regions. */
export const InlineLoader: React.FC<{ label?: string; size?: SpinnerSize; className?: string }> = ({
  label = 'Loading...',
  size = 'sm',
  className = '',
}) => (
  <span className={`inline-flex items-center gap-2 text-sm font-medium text-neutral-500 ${className}`.trim()} role="status">
    <Spinner size={size} label={label} />
    <span>{label}</span>
  </span>
);

InlineLoader.displayName = 'InlineLoader';
