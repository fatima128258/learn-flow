'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LinkButton } from '../ui/LinkButton';
import { LearnFlowLogo } from '../public/LearnFlowLogo';

/**
 * Landing-page scroll navigations. `id` must match the target section on the
 * home page; clicking smooth-scrolls when already on the landing page and
 * otherwise routes to `/#<id>` so the section loads and is scrolled to.
 */
const SECTIONS = [
  { href: '/#home', id: 'home', label: 'Home' },
  { href: '/#features', id: 'features', label: 'Features' },
  { href: '/#why-choose-us', id: 'why-choose-us', label: 'Why Choose Us' },
  { href: '/#faq', id: 'faq', label: 'FAQ' },
];

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Prevent background scroll while the mobile menu is open (accessibility)
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const closeMenu = useCallback(() => setMobileMenuOpen(false), []);

  const isLanding = pathname === '/';

  const handleSectionClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    closeMenu();

    if (isLanding) {
      e.preventDefault();
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    e.preventDefault();
    router.push(`/#${id}`);
  };

  const sectionLinkClasses = (active: boolean) =>
    `px-3.5 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
      active
        ? 'text-primary-700 bg-primary-50'
        : 'text-neutral-600 hover:text-primary-700 hover:bg-primary-50/70'
    }`;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 w-full animate-slide-down transition-all duration-300 ${
        scrolled
          ? 'bg-primary-50/95 backdrop-blur-md shadow-sm border-b border-primary-100'
          : 'bg-primary-50/80 backdrop-blur-sm border-b border-transparent'
      }`}
    >
      <nav className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12" aria-label="Primary">
        <div className="flex items-center justify-between h-16 lg:h-[68px]">
          <LearnFlowLogo href="/" />

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={section.href}
                onClick={(e) => handleSectionClick(e, section.id)}
                className={sectionLinkClasses(false)}
              >
                {section.label}
              </a>
            ))}
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden lg:flex items-center gap-2.5 shrink-0">
            <LinkButton
              href="/login"
              variant="primary"
              size="sm"
              className="rounded-md"
              showLoading
              loadingText="Loading..."
            >
              Login
            </LinkButton>
            <LinkButton
              href="/register"
              variant="primary"
              size="sm"
              className="rounded-md"
              showLoading
              loadingText="Loading..."
            >
              Sign Up
            </LinkButton>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="lg:hidden p-2.5 rounded-md text-neutral-600 hover:text-primary-700 hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition-colors"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
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
          id="mobile-menu"
          className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            mobileMenuOpen ? 'max-h-[460px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="py-4 border-t border-neutral-100">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={section.href}
                  onClick={(e) => handleSectionClick(e, section.id)}
                  className="px-4 py-2.5 rounded-md text-sm font-medium text-neutral-600 hover:text-primary-700 hover:bg-primary-50/70 transition-colors"
                >
                  {section.label}
                </a>
              ))}

              <div className="pt-4 mt-2 border-t border-neutral-200 flex flex-col gap-2.5">
                <LinkButton
                  href="/login"
                  variant="outline"
                  size="md"
                  fullWidth
                  className="rounded-md border-primary-200 text-primary-700 hover:bg-primary-50"
                  showLoading
                  loadingText="Loading..."
                  onClick={closeMenu}
                >
                  Login
                </LinkButton>
                <LinkButton
                  href="/register"
                  variant="primary"
                  size="md"
                  fullWidth
                  className="rounded-md"
                  showLoading
                  loadingText="Loading..."
                  onClick={closeMenu}
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
