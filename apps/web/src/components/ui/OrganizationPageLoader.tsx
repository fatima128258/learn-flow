import React from 'react';
import { Spinner } from './Spinner';

export const OrganizationPageLoader: React.FC = () => (
  <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center" role="status" aria-label="Loading">
    <Spinner size="lg" />
  </div>
);

OrganizationPageLoader.displayName = 'OrganizationPageLoader';
