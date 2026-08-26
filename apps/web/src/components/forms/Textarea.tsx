import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, label, helperText, className = '', id, rows = 3, ...rest }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const hasError = !!error;

    const baseStyles = 'block w-full rounded-md shadow-sm transition-colors';
    const normalStyles = 'border-neutral-300 focus:border-primary-500 focus:ring-primary-500';
    const errorStyles = 'border-error-500 focus:border-error-500 focus:ring-error-500';
    const disabledStyles = 'disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed';

    const textareaStyles = `${baseStyles} ${hasError ? errorStyles : normalStyles} ${disabledStyles} ${className} text-gray-900 placeholder:text-gray-400 bg-white px-3 py-2 text-base`;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-neutral-700 mb-1"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={textareaStyles}
          aria-invalid={hasError}
          aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
          {...rest}
        />
        {error && (
          <p id={`${textareaId}-error`} className="mt-1 text-sm text-error-600">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${textareaId}-helper`} className="mt-1 text-sm text-neutral-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
