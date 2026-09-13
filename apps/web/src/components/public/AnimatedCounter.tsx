'use client';

import React, { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  value: string;
  className?: string;
}

const counterPattern = /^([\d.]+)(K?)(.*)$/;

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ value, className = '' }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [displayValue, setDisplayValue] = useState('0');
  const hasStarted = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || hasStarted.current) return;

    const match = value.match(counterPattern);
    if (!match) {
      setDisplayValue(value);
      return;
    }

    const [, numericPart, unit, suffix] = match;
    const decimals = numericPart.includes('.') ? numericPart.split('.')[1].length : 0;
    const target = Number(numericPart) * (unit === 'K' ? 1000 : 1);
    const duration = 1800;
    let frameId = 0;
    let observer: IntersectionObserver | undefined;

    const formatValue = (current: number) => {
      const formatted = unit === 'K'
        ? `${(current / 1000).toFixed(decimals)}K`
        : current.toFixed(decimals);
      return `${formatted}${suffix}`;
    };

    const start = () => {
      if (hasStarted.current) return;
      hasStarted.current = true;

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setDisplayValue(value);
        return;
      }

      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(formatValue(target * eased));
        if (progress < 1) frameId = requestAnimationFrame(tick);
      };

      frameId = requestAnimationFrame(tick);
    };

    if (typeof IntersectionObserver === 'undefined') {
      start();
    } else {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            start();
            observer?.disconnect();
          }
        },
        { threshold: 0.35 }
      );
      observer.observe(element);
    }

    return () => {
      cancelAnimationFrame(frameId);
      observer?.disconnect();
    };
  }, [value]);

  return <span ref={ref} className={className}>{displayValue}</span>;
};

AnimatedCounter.displayName = 'AnimatedCounter';
