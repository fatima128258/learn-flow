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
      'rounded-xl border border-[#e5d5c4] bg-[#fffdf9] px-4 py-3 text-[#17212b] shadow-none focus:border-[#7a4a2e] focus:ring-2 focus:ring-[#a8784f]/20';
    const boxError =
      'rounded-xl border border-error-500 bg-[#fffdf9] px-4 py-3 text-[#17212b] shadow-none focus:border-error-500 focus:ring-2 focus:ring-error-500/20';
    const lineNormal =
      'rounded-xl border border-[#e5d5c4] bg-[#fffdf9] px-4 py-3 text-[#17212b] shadow-none focus:border-[#7a4a2e] focus:ring-2 focus:ring-[#a8784f]/20';
    const lineError =
      'rounded-xl border border-error-500 bg-[#fffdf9] px-4 py-3 text-[#17212b] shadow-none focus:border-error-500 focus:ring-2 focus:ring-error-500/20';

    const variantStyles = variant === 'line'
      ? hasError ? lineError : lineNormal
      : hasError ? boxError : boxNormal;

    const disabledStyles =
      'disabled:bg-[#f8f2eb] disabled:text-neutral-400 disabled:cursor-not-allowed disabled:border-[#ead8c6]';

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
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={inputStyles}
            aria-invalid={hasError}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...rest}
          />
        </div>
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
