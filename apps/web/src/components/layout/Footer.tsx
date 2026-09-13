import React from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/layout/Container';
import { LearnFlowLogo } from '@/components/public/LearnFlowLogo';
import { Reveal } from '@/components/public/Reveal';

const exploreLinks = [
  { href: '/#home', label: 'Home' },
  { href: '/#courses', label: 'Courses' },
  { href: '/#about', label: 'About' },
  { href: '/#contact', label: 'Contact' },
  { href: '/#faq', label: 'FAQ' },
];

const companyLinks = [
  { href: '/register', label: 'Get Started' },
  { href: '/login', label: 'Login' },
  { href: '/contact', label: 'Support' },
  { href: '/faq', label: 'FAQ' },
];

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#201611] text-[#f8eee8]">
      <Container size="xl" className="pt-12 pb-8 sm:pt-14 sm:pb-10">
        <Reveal>
        <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(47,31,28,0.94),rgba(23,17,15,0.96))] px-6 py-8 sm:px-8 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr_1fr_1.2fr]">
            <div>
              <LearnFlowLogo href="/" tone="light" />
              <p className="mt-4 max-w-xs text-sm leading-7 text-[#f0d9cc]">
                LearnFlow helps students, creators, and organizations turn learning into real progress.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d7b69a]">Explore</h4>
              <ul className="mt-4 space-y-3 text-sm text-[#f6e6de]">
                {exploreLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="transition hover:text-white">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d7b69a]">Company</h4>
              <ul className="mt-4 space-y-3 text-sm text-[#f6e6de]">
                {companyLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="transition hover:text-white">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div id="contact">
              <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d7b69a]">Stay Connected</h4>
              <div className="mt-4 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-2">
                <input
                  aria-label="Email address"
                  placeholder="Your email address"
                  className="w-full rounded-full border-0 bg-transparent px-3 py-2 text-sm text-white placeholder:text-[#d9bfae] focus:outline-none"
                />
                <button type="button" className="rounded-full bg-[#f0d2ae] px-4 py-2 text-sm font-semibold text-[#281b17] transition hover:bg-[#f7ddba]">
                  Join
                </button>
              </div>
              <div className="mt-4 flex items-center gap-3 text-sm text-[#f6e6de]">
                <a href="mailto:hello@learnflow.io" className="transition hover:text-white">hello@learnflow.io</a>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-[#dcc2af] sm:flex-row sm:items-center sm:justify-between">
            <p>© {currentYear} LearnFlow. All rights reserved.</p>
            <div className="flex items-center gap-5">
              <Link href="/privacy" className="transition hover:text-white">Privacy Policy</Link>
              <Link href="/terms" className="transition hover:text-white">Terms & Conditions</Link>
            </div>
          </div>
        </div>
        </Reveal>
      </Container>
    </footer>
  );
};

Footer.displayName = 'Footer';
