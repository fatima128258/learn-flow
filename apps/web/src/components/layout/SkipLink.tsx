'use client';

import React from 'react';

export const SkipLink: React.FC<{ targetId?: string }> = ({ targetId = 'main-content' }) => (
  <a
    href={`#${targetId}`}
    className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg"
  >
    Skip to main content
  </a>
);

SkipLink.displayName = 'SkipLink';