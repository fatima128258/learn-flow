import React from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      {/* Spacer matching the fixed navbar height so content is not hidden behind it */}
      <div className="h-16 lg:h-[68px]" aria-hidden="true" />

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 bg-gradient-to-br from-neutral-50 via-white to-primary-50/20">
        <div className="w-full max-w-md animate-fade-in">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
};

AuthLayout.displayName = 'AuthLayout';
