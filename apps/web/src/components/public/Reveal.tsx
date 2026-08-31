'use client';
import React, { useEffect, useRef, useState } from 'react';

export interface RevealProps {
  children: React.ReactNode;
  /** Delay before the reveal animation starts, in milliseconds */
  delay?: number;
  /** Initial vertical offset in pixels */
  y?: number;
  className?: string;
}

export const Reveal: React.FC<RevealProps> = ({
  children,
  delay = 0,
  y = 14,
  className = '',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reveal = () => setVisible(true);

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (prefersReduced) {
      const id = requestAnimationFrame(reveal);
      return () => cancelAnimationFrame(id);
    }

    // Safety net: never leave content stuck at opacity:0 if the observer
    // is unavailable or never fires (e.g. old browsers, layout edge cases).
    if (typeof IntersectionObserver === 'undefined') {
      reveal();
      return;
    }

    let safety: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          observer.disconnect();
          if (safety) clearTimeout(safety);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);

    // If the element is already on screen at mount, the observer fires on the
    // next frame; this timeout is only a last-resort guarantee.
    safety = setTimeout(reveal, 2500);

    return () => {
      observer.disconnect();
      if (safety) clearTimeout(safety);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`.trim()}
      style={
        {
          '--reveal-delay': `${delay}ms`,
          '--reveal-y': `${y}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
};

Reveal.displayName = 'Reveal';
