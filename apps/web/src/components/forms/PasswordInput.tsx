'use client';
import React, { useState } from 'react';
import { Input, InputProps } from '../ui/Input';

export interface PasswordInputProps extends Omit<InputProps, 'type'> {}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className = '', ...rest }, ref) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
      <Input
        ref={ref}
        type={isVisible ? 'text' : 'password'}
        className={`${className} pr-12`.trim()}
        endAdornment={
          <button
            type="button"
            onClick={() => setIsVisible((visible) => !visible)}
            aria-label={isVisible ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#7a4a2e] transition-colors hover:bg-[#f5ebdd] focus:outline-none focus:ring-2 focus:ring-[#a8784f]/30 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={rest.disabled}
          >
            {isVisible ? (
              <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.584 10.587a2 2 0 002.829 2.829M9.88 4.24A10.7 10.7 0 0112 4c5.5 0 9.5 4 10.5 8a10.7 10.7 0 01-3.03 4.88M6.228 6.228C4.51 7.39 3.31 9.08 1.5 12c1 4 5 8 10.5 8 1.55 0 2.95-.32 4.18-.87" />
              </svg>
            ) : (
              <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.5-7 9.75-7 9.75 7 9.75 7-3.5 7-9.75 7-9.75-7-9.75-7z" />
                <circle cx="12" cy="12" r="2.75" />
              </svg>
            )}
          </button>
        }
        {...rest}
      />
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
