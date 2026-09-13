'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LinkButton } from '../ui/LinkButton';
import { LearnFlowLogo } from '../public/LearnFlowLogo';

const SECTIONS = [
  { href: '/#home', id: 'home', label: 'Home' },
  { href: '/#features', id: 'features', label: 'Features' },
  { href: '/#about', id: 'about', label: 'Why Choose Us' },
  { href: '/#faq', id: 'faq', label: 'FAQ' },
];

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const pendingSectionRef = useRef<string | null>(null);
  const pendingSectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const routeSection = pathname.startsWith('/courses')
      ? 'features'
      : pathname.startsWith('/about')
        ? 'about'
        : pathname.startsWith('/contact')
          ? 'contact'
          : pathname.startsWith('/faq')
            ? 'faq'
            : pathname === '/'
              ? 'home'
              : null;

    if (!routeSection || pathname !== '/') {
      if (routeSection) setActiveSection(routeSection);
      return;
    }

    const sections = SECTIONS.map(({ id }) => document.getElementById(id)).filter(
      (section): section is HTMLElement => Boolean(section)
    );

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (pendingSectionRef.current) return;

        const visibleSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visibleSection) setActiveSection(visibleSection.target.id);
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: [0.1, 0.3, 0.6] }
    );

    sections.forEach((section) => observer.observe(section));
    return () => {
      observer.disconnect();
      if (pendingSectionTimerRef.current) {
        clearTimeout(pendingSectionTimerRef.current);
      }
    };
  }, [pathname]);

  const closeMenu = useCallback(() => setMobileMenuOpen(false), []);
  const isLanding = pathname === '/';

  const handleSectionClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    closeMenu();

    if (isLanding) {
      e.preventDefault();
      setActiveSection(id);
      pendingSectionRef.current = id;
      if (pendingSectionTimerRef.current) {
        clearTimeout(pendingSectionTimerRef.current);
      }
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      pendingSectionTimerRef.current = setTimeout(() => {
        pendingSectionRef.current = null;
      }, 900);
      return;
    }

    e.preventDefault();
    router.push(`/#${id}`);
  };

  const sectionLinkClasses = (active: boolean) =>
    `relative px-3.5 py-2 text-[15px] font-medium transition-colors duration-200 after:absolute after:bottom-0 after:left-3.5 after:h-0.5 after:bg-[#99501f] after:transition-all after:duration-250 ${
      active
        ? 'text-[#7a4a2a] after:right-3.5'
        : 'text-[#344047] hover:text-[#99501f] after:right-full hover:after:right-3.5'
    }`;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ${
        scrolled ? 'bg-[#fbf8f3] shadow-[0_4px_18px_rgba(88,53,33,0.07)] border-b border-[#eadfd4]' : 'bg-[#fbf8f3] border-b border-[#f0e7de]'
      }`}
    >
      <nav className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Primary">
        <div className="flex h-[72px] items-center justify-between lg:h-[80px]">
          <LearnFlowLogo href="/" tone="dark" size={38} />

          <div className="hidden items-center gap-5 lg:flex">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={section.href}
                onClick={(e) => handleSectionClick(e, section.id)}
                className={sectionLinkClasses(section.id === activeSection)}
              >
                {section.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-2.5 lg:flex">
            <LinkButton
              href="/login"
              variant="secondary"
              size="sm"
              className="h-11 rounded-full border border-[#dfc8b5] !bg-[#fffdf9] px-6 !text-[#563522] transition duration-200 hover:-translate-y-px hover:!bg-[#f7eee6]"
              showLoading
              loadingText="Loading..."
            >
              Login
            </LinkButton>
            <LinkButton
              href="/register"
              variant="secondary"
              size="sm"
              className="h-11 rounded-full !bg-[#5a2d18] px-6 !text-[#fffaf3] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:!bg-[#713b21] hover:shadow-md"
              showLoading
              loadingText="Loading..."
            >
              Get Started
            </LinkButton>
          </div>

          <button
            type="button"
            className="rounded-md p-2.5 text-[#4d382d] transition hover:bg-[#f4e8dd] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#99501f] lg:hidden"
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

        <div
          id="mobile-menu"
          className={`overflow-hidden transition-all duration-300 ease-in-out lg:hidden ${
            mobileMenuOpen ? 'max-h-[460px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="border-t border-[#eadbc9] py-4">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={section.href}
                  onClick={(e) => handleSectionClick(e, section.id)}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium text-[#344047] transition hover:bg-[#f5eae0] hover:text-[#99501f]"
                >
                  {section.label}
                </a>
              ))}

              <div className="mt-3 flex flex-col gap-2.5 border-t border-[#eadbc9] pt-4">
                <LinkButton
                  href="/login"
                  variant="secondary"
                  size="md"
                  fullWidth
                  className="rounded-full border-[#d9c1a9] !bg-[#fffdf9] !text-[#4d382d] hover:!bg-[#f5eae0]"
                  showLoading
                  loadingText="Loading..."
                  onClick={closeMenu}
                >
                  Login
                </LinkButton>
                <LinkButton
                  href="/register"
                  variant="secondary"
                  size="md"
                  fullWidth
                  className="rounded-full !bg-[#5a2d18] !text-[#fffaf3] hover:!bg-[#713b21]"
                  showLoading
                  loadingText="Loading..."
                  onClick={closeMenu}
                >
                  Get Started
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
