'use client';

import React from 'react';

export const SkipLink: React.FC<{ targetId?: string }> = ({ targetId = 'main-content' }) => (
  <a
    href={`#${targetId}`}
    className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-lg focus-visible:bg-primary-600 focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-white focus-visible:shadow-lg"
  >
    Skip to main content
  </a>
);

SkipLink.displayName = 'SkipLink';
