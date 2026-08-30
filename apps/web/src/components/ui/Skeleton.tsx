import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      className = '',
      variant = 'text',
      width,
      height,
      ...rest
    },
    ref
  ) => {
    const variantStyles = {
      text: 'rounded',
      circular: 'rounded-full',
      rectangular: 'rounded-lg',
    };

    const style: React.CSSProperties = {
      ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
      ...(height && { height: typeof height === 'number' ? `${height}px` : height }),
    };

    return (
      <div
        ref={ref}
        className={`animate-pulse bg-neutral-200 ${variantStyles[variant]} ${className}`.trim()}
        style={style}
        {...rest}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

// Prebuilt skeleton components for common patterns
export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white rounded-lg border border-neutral-200 p-6 ${className}`}>
    <Skeleton variant="rectangular" height={48} className="mb-4" />
    <Skeleton variant="text" height={24} className="mb-2" />
    <Skeleton variant="text" height={20} className="mb-2 w-4/5" />
    <Skeleton variant="text" height={20} className="w-3/5" />
  </div>
);

export const CourseCardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white rounded-lg border border-neutral-200 overflow-hidden ${className}`}>
    <Skeleton variant="rectangular" height={192} />
    <div className="p-6">
      <Skeleton variant="text" height={20} className="mb-3" />
      <Skeleton variant="text" height={24} className="mb-2" />
      <Skeleton variant="text" height={20} className="mb-2 w-4/5" />
      <Skeleton variant="text" height={20} className="w-3/5 mb-4" />
      <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
        <Skeleton variant="text" height={32} width={80} />
        <Skeleton variant="rectangular" height={36} width={100} />
      </div>
    </div>
  </div>
);

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 4,
  className = '',
}) => (
  <div className={`overflow-hidden rounded-lg border border-neutral-200 bg-white ${className}`} role="status" aria-label="Loading table">
    <div className="flex border-b border-neutral-200 bg-neutral-50 p-4">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} variant="text" height={16} className="mr-6 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, row) => (
      <div key={row} className="flex border-b border-neutral-100 p-4 last:border-0">
        {Array.from({ length: columns }).map((_, col) => (
          <Skeleton key={col} variant="text" height={16} className="mr-6 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

export interface DashboardSkeletonProps {
  cards?: number;
  className?: string;
}

export const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({
  cards = 4,
  className = '',
}) => (
  <div className={className} role="status" aria-label="Loading dashboard">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-lg border border-neutral-200 bg-white p-5">
          <Skeleton variant="rectangular" height={40} className="mb-3" />
          <Skeleton variant="text" height={24} className="mb-2 w-3/5" />
          <Skeleton variant="text" height={16} className="w-2/5" />
        </div>
      ))}
    </div>
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <CardSkeleton />
      </div>
      <CardSkeleton />
    </div>
  </div>
);
