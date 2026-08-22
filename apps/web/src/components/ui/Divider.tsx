import React from 'react';

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical';
  spacing?: 'sm' | 'md' | 'lg';
}

const spacingStyles = {
  horizontal: {
    sm: 'my-2',
    md: 'my-4',
    lg: 'my-8',
  },
  vertical: {
    sm: 'mx-2',
    md: 'mx-4',
    lg: 'mx-8',
  },
};

export const Divider = React.forwardRef<HTMLHRElement, DividerProps>(
  ({ orientation = 'horizontal', spacing = 'md', className = '', ...rest }, ref) => {
    const baseStyles = 'border-neutral-200';
    const orientationStyles = orientation === 'vertical' ? 'h-full w-px' : 'w-full h-px';
    const spacingStyle = spacingStyles[orientation][spacing];

    return (
      <hr
        ref={ref}
        className={`${baseStyles} ${orientationStyles} ${spacingStyle} ${className}`.trim()}
        {...rest}
      />
    );
  }
);

Divider.displayName = 'Divider';
