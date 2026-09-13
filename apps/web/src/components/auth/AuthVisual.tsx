import React from 'react';
import { LearnFlowLogo } from '../public/LearnFlowLogo';

const FEATURES = [
  'Structured courses and lessons',
  'Track progress as you learn',
  'Earn certificates when you finish',
];

const CheckIcon = () => (
  <svg
    className="h-5 w-5 flex-shrink-0 text-[#d69a5b]"
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
    <div className="relative hidden flex-col justify-between overflow-hidden bg-[#5a321f] px-10 py-12 text-[#fff9f0] lg:flex">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#7a4a2e]/50 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-[#a8784f]/30 blur-3xl" aria-hidden="true" />

      <div className="relative flex items-center animate-slide-up">
        <LearnFlowLogo href="/" tone="light" />
      </div>

      <div className="relative my-10 animate-slide-up" style={{ animationDelay: '80ms' }}>
        <h2 className="text-3xl font-bold leading-tight tracking-tight">
          Learn something that sticks.
        </h2>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-[#f5ebdd]">
          Courses, progress, and certificates in one calm, focused workspace —
          built for learners, instructors, and organizations.
        </p>

        <ul className="mt-8 space-y-3">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-sm text-[#fff9f0]">
              <CheckIcon />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-[#f5ebdd]/80 animate-slide-up" style={{ animationDelay: '160ms' }}>
        © {new Date().getFullYear()} LearnHub. All rights reserved.
      </p>
    </div>
  );
};

AuthVisual.displayName = 'AuthVisual';
