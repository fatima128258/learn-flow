import React from 'react';
import { Label } from '../ui/Label';

export interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  required,
  error,
  helperText,
  children,
  className = '',
}) => {
  return (
    <div className={`w-full ${className}`.trim()}>
      {label && (
        <Label htmlFor={htmlFor} required={required} className="mb-1">
          {label}
        </Label>
      )}
      {children}
      {error && (
        <p className="mt-1 text-sm text-error-600" role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-neutral-500">
          {helperText}
        </p>
      )}
    </div>
  );
};

FormField.displayName = 'FormField';
