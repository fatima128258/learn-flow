import React from 'react';

export const RouteLoader: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => {
  return (
    <div className="mx-auto max-w-5xl p-8" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-neutral-200" />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
            <div className="mt-4 h-8 w-16 animate-pulse rounded bg-neutral-200" />
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
            <div className="mt-4 h-8 w-16 animate-pulse rounded bg-neutral-200" />
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
            <div className="mt-4 h-8 w-16 animate-pulse rounded bg-neutral-200" />
          </div>
        </div>
      </div>
    </div>
  );
};

RouteLoader.displayName = 'RouteLoader';
