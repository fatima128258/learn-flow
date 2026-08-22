import React from 'react';
import { Button, ButtonProps } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  } & Partial<ButtonProps>;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'An error occurred while loading this content. Please try again.',
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`.trim()}>
      <div className="mb-4 text-error-500">
        <svg
          className="h-16 w-16"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">
        {title}
      </h3>
      <p className="text-sm text-neutral-600 max-w-md mb-6">
        {message}
      </p>
      {action && (
        <Button
          variant={action.variant || 'primary'}
          onClick={action.onClick}
          {...action}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};

ErrorState.displayName = 'ErrorState';
