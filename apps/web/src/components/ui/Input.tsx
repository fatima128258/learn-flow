import React from 'react';

export type InputVariant = 'box' | 'line';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  helperText?: string;
  /** 'box' = classic bordered field, 'line' = minimal bottom-border field */
  variant?: InputVariant;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error, label, helperText, variant = 'box', className = '', id, ...rest }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const hasError = !!error;

    const baseStyles =
      'block w-full text-base outline-none transition-all duration-200 placeholder:text-neutral-400';

    const boxNormal =
      'rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30';
    const boxError =
      'rounded-md border border-error-500 bg-white px-3 py-2 text-neutral-900 shadow-sm focus:border-error-500 focus:ring-2 focus:ring-error-500/30';
    const lineNormal =
      'rounded-none border-0 border-b-2 border-neutral-300 bg-transparent px-0 py-2.5 text-neutral-900 focus:border-primary-600';
    const lineError =
      'rounded-none border-0 border-b-2 border-error-500 bg-transparent px-0 py-2.5 text-neutral-900 focus:border-error-500';

    const variantStyles = variant === 'line'
      ? hasError ? lineError : lineNormal
      : hasError ? boxError : boxNormal;

    const disabledStyles =
      'disabled:bg-transparent disabled:text-neutral-400 disabled:cursor-not-allowed disabled:border-neutral-200';

    const inputStyles = `${baseStyles} ${variantStyles} ${disabledStyles} ${className}`.trim();

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-700 mb-1.5"
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
