import React from 'react';
import Link from 'next/link';

/**
 * Clean, minimal GraduationCap outline. Stroke-based so it renders as a crisp
 * dark cap on the warm-brown brand container behind it.
 */
const GraduationCapIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#ffffff"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0"
    aria-hidden="true"
  >
    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
    <path d="M22 10v6" />
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
  </svg>
);

export interface LearnFlowLogoProps {
  /** Pixel size of the brand mark (rounded square containing the cap icon) */
  size?: number;
  /** Show the "LearnFlow" wordmark next to the mark */
  withText?: boolean;
  /** Link target; renders a plain element when omitted */
  href?: string;
  /** Wordmark color tone for light and dark surfaces */
  tone?: 'dark' | 'light';
  /** Additional classes for the text wordmark */
  className?: string;
}

/**
 * LearnHub brand mark and wordmark. Keep the colors here so every surface
 * using the shared logo stays consistent with the warm LearnHub identity.
 */
export const LearnFlowLogo: React.FC<LearnFlowLogoProps> = ({
  size = 38,
  withText = true,
  href = '/',
  tone = 'dark',
  className = '',
}) => {
  const wordmarkColor = tone === 'light' ? 'text-[#fffaf3]' : 'text-[#1f2f35]';
  const hubColor = tone === 'light' ? 'text-[#d5a06f]' : 'text-[#99501f]';

  const mark = (
    <span className="inline-flex items-center gap-2.5 group shrink-0">
      <span
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#99501f]"
        style={{ width: size, height: size }}
      >
        <GraduationCapIcon size={Math.round(size * 0.72)} />
      </span>
      {withText && (
        <span className={`text-2xl font-bold tracking-tight ${wordmarkColor} ${className}`.trim()}>
          Learn<span className={hubColor}>Hub</span>
        </span>
      )}
    </span>
  );

  if (!href) return mark;

  return (
    <Link
      href={href}
      aria-label="LearnHub home"
      className="inline-flex rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#99501f]"
    >
      {mark}
    </Link>
  );
};

LearnFlowLogo.displayName = 'LearnFlowLogo';
