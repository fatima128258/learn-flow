import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error, label, helperText, className = '', id, ...rest }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const hasError = !!error;

    const baseStyles = 'block w-full rounded-md shadow-sm transition-colors';
    const normalStyles = 'border-neutral-300 focus:border-primary-500 focus:ring-primary-500';
    const errorStyles = 'border-error-500 focus:border-error-500 focus:ring-error-500';
    const disabledStyles = 'disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed';
    
    const inputStyles = `${baseStyles} ${hasError ? errorStyles : normalStyles} ${disabledStyles} ${className} text-gray-900 placeholder:text-gray-400 bg-white px-3 py-2 text-base`;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-700 mb-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={inputStyles}
          aria-invalid={hasError}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...rest}
        />
        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-sm text-error-600">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="mt-1 text-sm text-neutral-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
