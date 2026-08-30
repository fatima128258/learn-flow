import React from 'react';
import Link from 'next/link';
import { Container } from '../ui/layout/Container';
import { LinkButton } from '../ui/LinkButton';
import { Logo } from '../public/Logo';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const exploreLinks = [
    { href: '/#home', label: 'Home' },
    { href: '/#features', label: 'Features' },
    { href: '/#why-choose-us', label: 'Why Choose Us' },
    { href: '/#faq', label: 'FAQ' },
  ];

  const accountLinks = [
    { href: '/login', label: 'Login' },
    { href: '/register', label: 'Sign Up' },
  ];

  const contactRows = [
    {
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      label: 'fatimaramzan739@gmail.com',
      href: 'mailto:fatimaramzan739@gmail.com',
    },
    {
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      ),
      label: '03017277128',
      href: 'tel:03017277128',
    },
    {
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
        </svg>
      ),
      label: 'Jaranwala, Faisalabad',
      href: undefined,
    },
  ];

  const ColumnHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h4 className="text-xs font-semibold uppercase tracking-wider text-white/60">
      {children}
    </h4>
  );

  return (
    <footer className="bg-primary-800">
      <Container size="xl" className="py-14 sm:py-16">
        {/* Top CTA */}
        <div className="flex flex-col gap-6 rounded-2xl bg-primary-900 px-6 py-8 sm:px-10 sm:py-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Need help?
            </p>
            <h3 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              If you have any query, contact us
            </h3>
            <a
              href="tel:03017277128"
              className="mt-3 inline-flex items-center gap-2 text-sm text-white/80 transition-colors hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              03017277128
            </a>
          </div>
          <LinkButton
            href="/register"
            variant="primary"
            size="lg"
            fullWidth
            className="shrink-0 bg-white !text-primary-700 hover:!bg-primary-50 rounded-lg md:w-auto"
            showLoading
            loadingText="Redirecting..."
          >
            Enroll now
          </LinkButton>
        </div>

        {/* Main content */}
        <div className="mt-14 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_1.6fr_1fr_1fr]">
          {/* Brand */}
          <div className="lg:pr-6">
            <Logo href="/" tone="light" />
            <p className="mt-4 text-base font-semibold text-white">
              The learning platform for focused study
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-purple-100">
              LearnFlow is an online learning platform where learners enroll in structured
              courses, track their progress, take quizzes, and earn certificates. Instructors
              can create and manage courses, and organizations can manage their own learning
              programs.
            </p>
          </div>

          {/* Contact */}
          <div>
            <ColumnHeading>Contact</ColumnHeading>
            <ul className="mt-4 space-y-3">
              {contactRows.map((row) => (
                <li key={row.label}>
                  {row.href ? (
                    <a
                      href={row.href}
                      className="inline-flex items-center gap-3 text-[15px] text-purple-100 transition-colors hover:text-white"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white" aria-hidden="true">
                        {row.icon}
                      </span>
                      {row.label}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-3 text-[15px] text-purple-100">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white" aria-hidden="true">
                        {row.icon}
                      </span>
                      {row.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Explore */}
          <div>
            <ColumnHeading>Explore</ColumnHeading>
            <ul className="mt-4 space-y-3">
              {exploreLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-[15px] font-medium text-purple-100 transition-colors hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <ColumnHeading>Account</ColumnHeading>
            <ul className="mt-4 space-y-3">
              {accountLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[15px] font-medium text-purple-100 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-white/15 pt-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <p className="text-sm text-white/60">
              © {currentYear} LearnFlow. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy" className="text-white/60 transition-colors hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="text-white/60 transition-colors hover:text-white">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
};

Footer.displayName = 'Footer';
