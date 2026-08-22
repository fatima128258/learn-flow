'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, ButtonProps } from './Button';

export interface LinkButtonProps extends Omit<ButtonProps, 'onClick'> {
  href: string;
  /** If true, uses client-side navigation with loading state */
  showLoading?: boolean;
  /** Custom loading text during navigation */
  loadingText?: string;
}

export const LinkButton = React.forwardRef<HTMLButtonElement, LinkButtonProps>(
  (
    {
      href,
      showLoading = false,
      loadingText,
      children,
      ...buttonProps
    },
    ref
  ) => {
    const router = useRouter();
    const [isNavigating, setIsNavigating] = useState(false);

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
      if (showLoading) {
        e.preventDefault();
        setIsNavigating(true);
        
        try {
          router.push(href);
          // Reset after a brief delay to handle navigation completion
          setTimeout(() => setIsNavigating(false), 1000);
        } catch (error) {
          setIsNavigating(false);
        }
      }
    };

    if (!showLoading) {
      // Simple link button without loading state
      return (
        <Link href={href}>
          <Button ref={ref} {...buttonProps}>
            {children}
          </Button>
        </Link>
      );
    }

    // Button with loading state during navigation
    return (
      <Button
        ref={ref}
        {...buttonProps}
        loading={isNavigating}
        onClick={handleClick}
      >
        {isNavigating && loadingText ? loadingText : children}
      </Button>
    );
  }
);

LinkButton.displayName = 'LinkButton';
