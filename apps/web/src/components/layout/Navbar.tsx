'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { LinkButton } from '../ui/LinkButton';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/courses', label: 'Courses' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(href);
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-md'
          : 'bg-white/80 backdrop-blur-sm border-b border-neutral-200'
      }`}
    >
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Top">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center space-x-2 group"
            aria-label="LearnFlow Home"
          >
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm">
              <span className="text-white font-bold text-lg">L</span>
            </div>
            <span className="text-xl font-bold text-neutral-900 group-hover:text-primary-600 transition-colors">
              LearnFlow
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  isActive(link.href)
                    ? 'text-primary-600 bg-primary-50'
                    : 'text-neutral-700 hover:text-primary-600 hover:bg-neutral-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center space-x-3">
            <LinkButton 
              href="/login" 
              variant="ghost" 
              size="sm"
              showLoading
              loadingText="Loading..."
            >
              Sign in
            </LinkButton>
            <LinkButton 
              href="/register" 
              variant="primary" 
              size="sm"
              showLoading
              loadingText="Loading..."
            >
              Get started
            </LinkButton>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="md:hidden p-2 rounded-md text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
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
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-neutral-200 animate-slide-down">
            <nav className="flex flex-col space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive(link.href)
                      ? 'text-primary-600 bg-primary-50'
                      : 'text-neutral-700 hover:text-primary-600 hover:bg-neutral-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              
              <div className="pt-4 mt-4 border-t border-neutral-200 space-y-2">
                <LinkButton 
                  href="/login" 
                  variant="ghost" 
                  size="sm" 
                  fullWidth
                  showLoading
                  loadingText="Loading..."
                >
                  Sign in
                </LinkButton>
                <LinkButton 
                  href="/register" 
                  variant="primary" 
                  size="sm" 
                  fullWidth
                  showLoading
                  loadingText="Loading..."
                >
                  Get started
                </LinkButton>
              </div>
            </nav>
          </div>
        )}
      </nav>
    </header>
  );
};

Navbar.displayName = 'Navbar';
