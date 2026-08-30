import React from 'react';

export interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Consistent heading + action row used inside dashboard cards and sections.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`.trim()}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

SectionHeader.displayName = 'SectionHeader';