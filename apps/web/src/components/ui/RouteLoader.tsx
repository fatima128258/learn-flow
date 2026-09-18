import React from 'react';
import { PageLoader } from './Spinner';

export const RouteLoader: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => {
  return <PageLoader label={label} />;
};

RouteLoader.displayName = 'RouteLoader';
