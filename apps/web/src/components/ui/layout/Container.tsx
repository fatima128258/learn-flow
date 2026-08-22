import React from 'react';

export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  /** Logical size of the container (maps to Tailwind max-w-*) */
  size?: ContainerSize;
}

const sizeClassMap: Record<ContainerSize, string> = {
  sm: 'max-w-2xl',
  md: 'max-w-4xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
  full: 'max-w-full'
};

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ children, className = '', size = 'lg', ...rest }, ref) => {
    const sizeClass = sizeClassMap[size] ?? sizeClassMap.lg;

    return (
      <div
        ref={ref}
        className={`${sizeClass} mx-auto container-responsive w-full ${className}`.trim()}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

Container.displayName = 'Container';

export default Container;
