'use client';
import React, { useState } from 'react';

export interface AppShellProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children, sidebar, header }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {sidebar && (
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-neutral-200 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="h-full overflow-y-auto">
            {sidebar}
          </div>
        </aside>
      )}

      {/* Main content area */}
      <div className="flex-1 lg:pl-0">
        {/* Header */}
        {header && (
          <header className="bg-white border-b border-neutral-200 sticky top-0 z-30">
            <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
              {/* Mobile menu button */}
              {sidebar && (
                <button
                  type="button"
                  className="lg:hidden p-2 rounded-md text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  <span className="sr-only">Open sidebar</span>
                  <svg
                    className="h-6 w-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </button>
              )}
              {header}
            </div>
          </header>
        )}

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
};

AppShell.displayName = 'AppShell';
