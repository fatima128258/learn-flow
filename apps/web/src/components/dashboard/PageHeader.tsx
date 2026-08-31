import React from 'react';
import { Badge, type BadgeVariant } from '../ui/Badge';

export interface PageHeaderBadge {
  label: string;
  variant?: BadgeVariant;
}

export interface PageHeaderProps {
  title: string;
  /** Small inline count/suffix shown next to title in gray */
  titleSuffix?: string;
  /** Small uppercase eyebrow label above the title */
  subtitle?: string;
  description?: string;
  /** Status chips rendered under the description (e.g. org status) */
  badges?: PageHeaderBadge[];
  /** Right-aligned actions (buttons, links, search, etc.) */
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  className?: string;
}

/**
 * Shared premium page header used across every dashboard. Gives each role page
 * the same typographic rhythm and action placement while content differs.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  titleSuffix,
  subtitle,
  description,
  badges,
  actions,
  breadcrumbs,
  className = '',
}) => {
  return (
    <div className={`mb-8 ${className}`.trim()}>
      {breadcrumbs && <div className="mb-4">{breadcrumbs}</div>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-baseline gap-2.5 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
            {title}
            {titleSuffix && (
              <span className="text-base font-normal text-neutral-400">{titleSuffix}</span>
            )}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600 sm:text-base">
              {description}
            </p>
          )}
          {badges && badges.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {badges.map((badge) => (
                <Badge key={badge.label} variant={badge.variant} size="sm">
                  {badge.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
        )}
      </div>
    </div>
  );
};

PageHeader.displayName = 'PageHeader';