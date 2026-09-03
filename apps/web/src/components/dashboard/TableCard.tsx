import React from 'react';
import { SectionHeader } from './SectionHeader';

export interface TableCardProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Consistent white card that wraps hand-rolled tables across dashboards so
 * every table shares the same shell, spacing, and header treatment.
 */
export const TableCard: React.FC<TableCardProps> = ({
  title,
  description,
  action,
  children,
  className = '',
}) => {
  return (
    <div className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`.trim()}>
      {(title || description || action) && (
        <div className="border-b border-neutral-200 px-5 py-4">
          <SectionHeader title={title ?? ''} description={description} action={action} />
        </div>
      )}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
};

TableCard.displayName = 'TableCard';

export const tableHeadClass =
  'px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500';

export const tableCellClass = 'px-5 py-4 text-sm';

export const tableRowHoverClass = 'hover:bg-neutral-50';
