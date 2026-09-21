import React from 'react';
import { Spinner } from './Spinner';

export const OrganizationPageLoader: React.FC = () => (
  <div
    className="-m-4 flex min-h-[calc(100dvh-4rem)] w-[calc(100%+2rem)] items-center justify-center sm:-m-6 sm:min-h-[calc(100dvh-4rem)] sm:w-[calc(100%+3rem)] lg:-m-8 lg:min-h-[calc(100dvh-4rem)] lg:w-[calc(100%+4rem)]"
    role="status"
    aria-label="Loading"
  >
    <Spinner size="lg" />
  </div>
);

OrganizationPageLoader.displayName = 'OrganizationPageLoader';
