'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LinkButton } from '../ui/LinkButton';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'Why Choose Us' },
    { href: '/faq', label: 'FAQ' },
    { href: '/courses', label: 'Features' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname?.startsWith(href);
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm'
          : 'bg-white'
      } border-b border-neutral-100`}
    >
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Top">
        <div className="flex items-center justify-between h-16 lg:h-[72px]">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center space-x-2.5 group shrink-0"
            aria-label="Personal Study Mentor Home"
          >
            <svg
              className="w-8 h-8 text-slate-800 transition-transform group-hover:scale-105"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 3L1 9L5 11.18V17.18L12 21L19 17.18V11.18L21 10.09V17H23V9L12 3ZM18.82 9L12 12.72L5.18 9L12 5.28L18.82 9ZM17 15.99L12 18.72L7 15.99V12.27L12 15L17 12.27V15.99Z"
                fill="currentColor"
              />
            </svg>
            <span className="text-lg font-bold text-slate-900 group-hover:text-slate-700 transition-colors whitespace-nowrap">
              Personal Study Mentor
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive(link.href)
                    ? 'text-slate-900 bg-slate-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden lg:flex items-center space-x-3 shrink-0">
            <LinkButton
              href="/login"
              variant="outline"
              size="sm"
              className="rounded-full !border-slate-300 !text-slate-700 hover:!bg-slate-50 hover:!border-slate-400 px-5"
              showLoading
              loadingText="Loading..."
            >
              Login
            </LinkButton>
            <LinkButton
              href="/register"
              variant="primary"
              size="sm"
              className="rounded-full !bg-slate-800 hover:!bg-slate-700 !text-white px-5 shadow-sm"
              showLoading
              loadingText="Loading..."
            >
              Sign Up
            </LinkButton>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            mobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="py-4 border-t border-slate-100">
            <nav className="flex flex-col space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive(link.href)
                      ? 'text-slate-900 bg-slate-100'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              <div className="pt-4 mt-2 border-t border-slate-100 flex flex-col space-y-2.5">
                <LinkButton
                  href="/login"
                  variant="outline"
                  size="sm"
                  fullWidth
                  className="rounded-full !border-slate-300 !text-slate-700 hover:!bg-slate-50"
                  showLoading
                  loadingText="Loading..."
                >
                  Login
                </LinkButton>
                <LinkButton
                  href="/register"
                  variant="primary"
                  size="sm"
                  fullWidth
                  className="rounded-full !bg-slate-800 hover:!bg-slate-700 !text-white shadow-sm"
                  showLoading
                  loadingText="Loading..."
                >
                  Sign Up
                </LinkButton>
              </div>
            </nav>
          </div>
        </div>
      </nav>
    </header>
  );
};

Navbar.displayName = 'Navbar';
