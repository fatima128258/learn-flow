import React from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
};

MainLayout.displayName = 'MainLayout';
