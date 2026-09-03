'use client';
import React from 'react';
import { Input, InputProps } from '../ui/Input';

export interface PasswordInputProps extends Omit<InputProps, 'type'> {}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className = '', ...rest }, ref) => {
    return (
      <div className="relative">
        <Input
          ref={ref}
          type="password"
          className={className}
          {...rest}
        />
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
