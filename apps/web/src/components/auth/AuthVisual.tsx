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
      </div>

      <p className="relative text-xs text-primary-200/80 animate-slide-up" style={{ animationDelay: '160ms' }}>
        © {new Date().getFullYear()} LearnFlow. All rights reserved.
      </p>
    </div>
  );
};

AuthVisual.displayName = 'AuthVisual';
