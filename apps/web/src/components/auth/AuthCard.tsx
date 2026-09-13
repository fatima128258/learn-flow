import React from 'react';
import Link from 'next/link';

export interface AuthCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: {
    text: string;
    linkText: string;
    linkHref?: string;
    linkOnClick?: () => void;
  };
}

export const AuthCard: React.FC<AuthCardProps> = ({
  title,
  description,
  children,
  footer,
}) => {
  const renderFooterLink = () => {
    if (!footer) return null;

    if (footer.linkOnClick) {
      return (
        <button
          type="button"
          onClick={footer.linkOnClick}
          className="font-semibold text-[#7a4a2e] underline-offset-2 transition-colors hover:text-[#5a321f] hover:underline"
        >
          {footer.linkText}
        </button>
      );
    }

    return (
      <Link
        href={footer.linkHref ?? '#'}
        className="font-semibold text-[#7a4a2e] underline-offset-2 transition-colors hover:text-[#5a321f] hover:underline"
      >
        {footer.linkText}
      </Link>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 animate-slide-up">
        <h1 className="text-3xl font-bold tracking-tight text-[#17212b] sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 text-base leading-relaxed text-[#5f6368]">
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
          className="mt-8 animate-slide-up border-t border-[#ead8c6] pt-6"
          style={{ animationDelay: '200ms' }}
        >
          <p className="text-center text-sm text-[#5f6368]">
            {footer.text}{' '}
            {renderFooterLink()}
          </p>
        </div>
      )}
    </div>
  );
};

AuthCard.displayName = 'AuthCard';
