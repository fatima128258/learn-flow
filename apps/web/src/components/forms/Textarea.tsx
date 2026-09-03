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

    const baseStyles = 'block w-full text-base outline-none transition-all duration-200 placeholder:text-neutral-400';
    const boxNormal = 'rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30';
    const boxError = 'rounded-md border border-error-500 bg-white px-3 py-2 text-neutral-900 shadow-sm focus:border-error-500 focus:ring-2 focus:ring-error-500/30';
    const disabledStyles = 'disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed disabled:border-neutral-200';

    const textareaStyles = `${baseStyles} ${hasError ? boxError : boxNormal} ${disabledStyles} ${className}`;

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
