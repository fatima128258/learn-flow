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
