import React from 'react';
import { Logo } from '../public/Logo';

const FEATURES = [
  'Structured courses and lessons',
  'Track progress as you learn',
  'Earn certificates when you finish',
];

const CheckIcon = () => (
  <svg
    className="h-5 w-5 flex-shrink-0 text-primary-200"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
      clipRule="evenodd"
    />
  </svg>
);

/**
 * Branded left pane for the split authentication layout. Solid LearnFlow
 * primary surface (no gradient), with a simple, on-brand education
 * illustration built from shapes — never stock photography.
 */
export const AuthVisual: React.FC = () => {
  return (
    <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-primary-700 px-10 py-12 text-white">
      {/* subtle tonal panel, not a gradient */}
      <div className="pointer-events-none absolute inset-0 bg-primary-800/40" aria-hidden="true" />

      <div className="relative flex items-center animate-slide-up">
        <Logo href="/" tone="light" />
      </div>

      <div className="relative my-10 animate-slide-up" style={{ animationDelay: '80ms' }}>
        <h2 className="text-3xl font-bold leading-tight tracking-tight">
          Learn something that sticks.
        </h2>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-primary-100">
          Courses, progress, and certificates in one calm, focused workspace —
          built for learners, instructors, and organizations.
        </p>

        <ul className="mt-8 space-y-3">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-sm text-primary-50">
              <CheckIcon />
              {feature}
            </li>
          ))}
        </ul>

        {/* Simple education illustration: lesson card + progress */}
        <div className="mt-10 w-full max-w-sm" aria-hidden="true">
          <div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/15 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="h-2 w-2/3 rounded-full bg-white/40" />
                <div className="mt-2 h-2 w-1/3 rounded-full bg-white/20" />
              </div>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs text-primary-100">
                <span>Module progress</span>
                <span>68%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                <div className="h-full w-[68%] rounded-full bg-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="relative text-xs text-primary-200/80 animate-slide-up" style={{ animationDelay: '160ms' }}>
        © {new Date().getFullYear()} LearnFlow. All rights reserved.
      </p>
    </div>
  );
};

AuthVisual.displayName = 'AuthVisual';
