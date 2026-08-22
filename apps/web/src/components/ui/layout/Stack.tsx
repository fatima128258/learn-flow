import React from 'react';

export type StackDirection = 'vertical' | 'horizontal';
export type StackSpacing = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type StackAlign = 'start' | 'center' | 'end' | 'stretch';
export type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around';

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  direction?: StackDirection;
  spacing?: StackSpacing;
  align?: StackAlign;
  justify?: StackJustify;
  className?: string;
}

const spacingStyles: Record<StackDirection, Record<StackSpacing, string>> = {
  vertical: {
    none: 'space-y-0',
    xs: 'space-y-1',
    sm: 'space-y-2',
    md: 'space-y-4',
    lg: 'space-y-6',
    xl: 'space-y-8',
  },
  horizontal: {
    none: 'space-x-0',
    xs: 'space-x-1',
    sm: 'space-x-2',
    md: 'space-x-4',
    lg: 'space-x-6',
    xl: 'space-x-8',
  },
};

const alignStyles: Record<StackAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

const justifyStyles: Record<StackJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
};

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    {
      children,
      direction = 'vertical',
      spacing = 'md',
      align = 'stretch',
      justify = 'start',
      className = '',
      ...rest
    },
    ref
  ) => {
    const baseStyles = 'flex';
    const directionStyle = direction === 'horizontal' ? 'flex-row' : 'flex-col';

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${directionStyle} ${spacingStyles[direction][spacing]} ${alignStyles[align]} ${justifyStyles[justify]} ${className}`.trim()}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

Stack.displayName = 'Stack';
