import React from 'react';
import Link from 'next/link';

export function QuizSteps({
  active,
  detailsHref,
  questionsHref,
}: {
  active: 'details' | 'questions';
  detailsHref?: string;
  questionsHref?: string;
}) {
  const steps = [
    { key: 'details', label: 'Quiz Details', number: 1 },
    { key: 'questions', label: 'Add Questions', number: 2 },
  ] as const;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-[#e9ece9] bg-[#f8faf9] p-2">
      {steps.map((step) => {
        const isActive = step.key === active;
        const content = (
          <>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${isActive ? 'bg-[#5a321f] font-bold text-white ring-2 ring-[#d69a5b]/40' : 'border border-[#e4e7e5] bg-white text-neutral-500'}`}>
              {step.number}
            </span>
            {step.label}
          </>
        );
        const className = `flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm sm:text-sm ${isActive ? 'border-[#d69a5b] bg-[#f5ebdd] text-[#5a321f] shadow-[0_2px_8px_rgb(90_50_31_/_0.12)]' : 'border-transparent text-neutral-500'}`;
        const href = step.key === 'details' ? detailsHref : questionsHref;

        return href ? (
          <Link key={step.key} href={href} className={`${className} transition-colors hover:border-[#ead8c6] hover:bg-[#f5ebdd]/60`}>
            {content}
          </Link>
        ) : (
          <div key={step.key} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
