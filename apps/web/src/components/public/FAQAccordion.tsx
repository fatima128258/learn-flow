'use client';
import React, { useMemo, useState } from 'react';
import { Accordion, AccordionItem } from './Accordion';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { LinkButton } from '../ui/LinkButton';

export interface FAQAccordionProps {
  items: AccordionItem[];
  className?: string;
}

export const FAQAccordion: React.FC<FAQAccordionProps> = ({ items, className = '' }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        (typeof item.answer === 'string' && item.answer.toLowerCase().includes(q))
    );
  }, [query, items]);

  return (
    <div className={className}>
      <div className="mx-auto mb-10 max-w-xl">
        <label htmlFor="faq-search" className="sr-only">
          Search frequently asked questions
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <Input
            id="faq-search"
            type="search"
            placeholder="Search questions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
            aria-label="Search frequently asked questions"
          />
        </div>
      </div>

      {filtered.length > 0 ? (
        <Accordion items={filtered} defaultOpen={filtered.length === 1 ? [filtered[0].id] : []} className="mx-auto max-w-3xl" />
      ) : (
        <div className="mx-auto max-w-md text-center">
          <EmptyState
            title="No matching questions"
            description="Try a different keyword, or reach out to our team and we'll help you out."
          />
          <LinkButton href="/contact" variant="primary" className="mt-2">
            Contact us
          </LinkButton>
        </div>
      )}
    </div>
  );
};

FAQAccordion.displayName = 'FAQAccordion';
