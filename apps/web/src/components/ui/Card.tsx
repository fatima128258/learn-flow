import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const shadowStyles = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      padding = 'md',
      shadow = 'md',
      hover = false,
      className = '',
      ...rest
    },
    ref
  ) => {
    const baseStyles = 'bg-white rounded-lg border border-neutral-200';
    const hoverStyles = hover ? 'transition-shadow hover:shadow-xl' : '';

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${paddingStyles[padding]} ${shadowStyles[shadow]} ${hoverStyles} ${className}`.trim()}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className = '', ...rest }, ref) => {
    return (
      <div ref={ref} className={`mb-4 ${className}`.trim()} {...rest}>
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ children, as: Component = 'h3', className = '', ...rest }, ref) => {
    return (
      <Component
        ref={ref}
        className={`text-xl font-semibold text-neutral-900 ${className}`.trim()}
        {...rest}
      >
        {children}
      </Component>
    );
  }
);

CardTitle.displayName = 'CardTitle';

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ children, className = '', ...rest }, ref) => {
    return (
      <p
        ref={ref}
        className={`text-sm text-neutral-600 ${className}`.trim()}
        {...rest}
      >
        {children}
      </p>
    );
  }
);

CardDescription.displayName = 'CardDescription';
