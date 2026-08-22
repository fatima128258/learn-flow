import React from 'react';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  children: React.ReactNode;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ required, className = '', children, ...rest }, ref) => {
    return (
      <label
        ref={ref}
        className={`block text-sm font-medium text-neutral-700 ${className}`.trim()}
        {...rest}
      >
        {children}
        {required && <span className="text-error-600 ml-1">*</span>}
      </label>
    );
  }
);

Label.displayName = 'Label';
