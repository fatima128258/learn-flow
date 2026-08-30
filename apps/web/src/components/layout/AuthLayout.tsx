import React from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { AuthVisual } from '../auth/AuthVisual';

export interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      <Navbar />
      {/* Spacer matching the fixed navbar height so content is not hidden behind it */}
      <div className="h-16 lg:h-[68px]" aria-hidden="true" />

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-5xl animate-fade-in">
          <div className="grid overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xl lg:grid-cols-2">
            <AuthVisual />
            <div className="px-6 py-10 sm:px-12 sm:py-12">{children}</div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

AuthLayout.displayName = 'AuthLayout';
