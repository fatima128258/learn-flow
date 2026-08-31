import React from 'react';
import Link from 'next/link';
import { Card } from '../ui/Card';

export interface CategoryCardProps {
  name: string;
  description?: string;
  icon: React.ReactNode;
  href?: string;
  className?: string;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  name,
  description,
  icon,
  href = '/courses',
  className = '',
}) => {
  return (
    <Link href={href} className="group block focus:outline-none">
      <Card
        hover
        padding="lg"
        className={`h-full border border-neutral-200 transition-all duration-300 group-hover:border-primary-200 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-primary-500 ${className}`.trim()}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600 mb-4 transition-colors duration-300 group-hover:bg-primary-100">
          {icon}
        </div>
        <h3 className="text-base font-semibold text-neutral-900 mb-1 group-hover:text-primary-700 transition-colors">
          {name}
        </h3>
        {description && (
          <p className="text-sm text-neutral-600 leading-relaxed">{description}</p>
        )}
      </Card>
    </Link>
  );
};

CategoryCard.displayName = 'CategoryCard';
