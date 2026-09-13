import React from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { AuthVisual } from '../auth/AuthVisual';
import { LearnFlowLogo } from '../public/LearnFlowLogo';

export interface AuthLayoutProps {
  children: React.ReactNode;
  hideChrome?: boolean;
  noScroll?: boolean;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, hideChrome = false, noScroll = false }) => {
  return (
    <div className={`flex min-h-screen flex-col overflow-x-hidden bg-[#fff9f0] ${noScroll ? 'lg:min-h-0 lg:h-screen lg:overflow-hidden' : ''}`}>
      {!hideChrome && (
        <>
          <Navbar />
          {/* Spacer matching the fixed navbar height so content is not hidden behind it */}
          <div className="h-16 lg:h-[68px]" aria-hidden="true" />
        </>
      )}

      <main className={`relative flex flex-1 justify-center px-4 py-8 sm:px-6 lg:px-8 ${noScroll ? 'items-center overflow-hidden lg:min-h-0 lg:py-4' : 'items-start overflow-y-auto'}`}>
        <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-[#f5ebdd] blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-[#f8e8d5] blur-3xl" />
        <div className="relative mx-auto w-full max-w-6xl animate-fade-in">
          <div className="mb-8 flex justify-center lg:hidden">
            <LearnFlowLogo href="/" tone="dark" size={38} />
          </div>
          <div className="grid overflow-hidden rounded-[28px] border border-[#ead8c6] bg-[#fffdf9] shadow-[0_24px_70px_rgba(90,50,31,0.12)] lg:grid-cols-2">
            <AuthVisual />
            <div className="px-6 py-8 sm:px-12 sm:py-10 lg:px-16">{children}</div>
          </div>
        </div>
      </main>

      {!hideChrome && <Footer />}
    </div>
  );
};

AuthLayout.displayName = 'AuthLayout';
