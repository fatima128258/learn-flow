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
    <div className="relative bg-white rounded-2xl shadow-xl border border-neutral-200 p-8 sm:p-10 animate-slide-up">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 shadow-sm mb-4">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-neutral-900 mb-2 tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-base text-neutral-600 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Form Content */}
      <div className="space-y-5">
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div className="mt-8 pt-6 border-t border-neutral-200">
          <p className="text-center text-sm text-neutral-600">
            {footer.text}{' '}
            <Link
              href={footer.linkHref}
              className="font-semibold text-primary-600 hover:text-primary-700 transition-colors underline-offset-2 hover:underline"
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
