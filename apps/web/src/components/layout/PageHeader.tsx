import React from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  action,
  breadcrumbs,
  className = '',
}) => {
  return (
    <div className={`bg-white border-b border-neutral-200 ${className}`.trim()}>
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {breadcrumbs && (
          <div className="mb-4">
            {breadcrumbs}
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 truncate">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-sm text-neutral-600">
                {description}
              </p>
            )}
          </div>
          {action && (
            <div className="flex-shrink-0">
              {action}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

PageHeader.displayName = 'PageHeader';
