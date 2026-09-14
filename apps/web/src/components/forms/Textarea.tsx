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
    const boxNormal = 'rounded-xl border border-[#e5d5c4] bg-[#fffdf9] px-4 py-3 text-[#17212b] shadow-none focus:border-[#7a4a2e] focus:ring-2 focus:ring-[#a8784f]/20';
    const boxError = 'rounded-xl border border-error-500 bg-[#fffdf9] px-4 py-3 text-[#17212b] shadow-none focus:border-error-500 focus:ring-2 focus:ring-error-500/20';
    const disabledStyles = 'disabled:bg-[#f8f2eb] disabled:text-neutral-400 disabled:cursor-not-allowed disabled:border-[#ead8c6]';

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
