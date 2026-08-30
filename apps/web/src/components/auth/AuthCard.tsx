import React from 'react';
import Link from 'next/link';

export interface AuthCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: {
    text: string;
    linkText: string;
    linkHref: string;
  };
}

export const AuthCard: React.FC<AuthCardProps> = ({
  title,
  description,
  children,
  footer,
}) => {
  return (
    <div>
      {/* Header */}
      <div className="mb-8 animate-slide-up">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-base leading-relaxed text-neutral-600">
            {description}
          </p>
        )}
      </div>

      {/* Form Content */}
      <div className="animate-slide-up" style={{ animationDelay: '120ms' }}>
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div
          className="mt-8 animate-slide-up border-t border-neutral-200 pt-6"
          style={{ animationDelay: '200ms' }}
        >
          <p className="text-center text-sm text-neutral-600">
            {footer.text}{' '}
            <Link
              href={footer.linkHref}
              className="font-semibold text-primary-600 underline-offset-2 transition-colors hover:text-primary-700 hover:underline"
            >
              {footer.linkText}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
};

AuthCard.displayName = 'AuthCard';
