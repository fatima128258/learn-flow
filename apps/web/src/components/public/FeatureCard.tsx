import React from 'react';
import { Card } from '../ui/Card';

export interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  /** Tailwind classes for the icon container background/text */
  iconClassName?: string;
  className?: string;
  /** Renders the enlarged, highlighted lead-feature variant */
  featured?: boolean;
  /** Small keyword pills rendered under the description (featured variant) */
  tags?: string[];
  /** Forwarded to the underlying card element (e.g. aria-hidden for duplicates) */
  ariaHidden?: boolean;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  iconClassName,
  className = '',
  featured = false,
  tags,
  ariaHidden,
}) => {
  const iconContainer = featured
    ? 'h-16 w-16 mb-6'
    : 'h-14 w-14 mb-5';
  const iconSize = featured ? 'h-8 w-8' : 'h-7 w-7';
  const resolvedIconClassName = iconClassName ?? 'bg-primary-50 text-primary-600';

  const surface = featured
    ? '!bg-primary-50 !border-primary-200 hover:!border-primary-400 hover:shadow-xl'
    : 'bg-white border-neutral-200 hover:border-primary-300 hover:shadow-lg';

  const iconEl = React.isValidElement(icon)
    ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
        className: iconSize,
      })
    : icon;

  return (
    <Card
      padding="lg"
      aria-hidden={ariaHidden}
      className={`group h-full border-2 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.02] ${surface} ${className}`.trim()}
    >
      <div
        className={`flex ${iconContainer} items-center justify-center rounded-2xl transition-transform duration-300 ease-out group-hover:scale-[1.06] group-hover:-translate-y-0.5 ${resolvedIconClassName}`.trim()}
      >
        {iconEl}
      </div>
      <h3
        className={`font-semibold text-neutral-900 mb-2 transition-colors group-hover:text-primary-700 ${
          featured ? 'text-2xl' : 'text-xl'
        }`.trim()}
      >
        {title}
      </h3>
      <p className="text-neutral-600 leading-relaxed">{description}</p>

      {featured && tags && tags.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full bg-white px-3 py-1 text-xs font-medium text-primary-700 ring-1 ring-inset ring-primary-100"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

FeatureCard.displayName = 'FeatureCard';
