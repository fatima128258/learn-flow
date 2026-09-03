import React from 'react';
import { Button, ButtonProps } from '../ui/Button';

export interface SubmitButtonProps extends Omit<ButtonProps, 'type'> {
  loading?: boolean;
  loadingText?: string;
}

export const SubmitButton = React.forwardRef<HTMLButtonElement, SubmitButtonProps>(
  ({ loading, loadingText, children, disabled, variant = 'primary', ...rest }, ref) => {
    return (
      <Button
        ref={ref}
        type="submit"
        loading={loading}
        disabled={disabled || loading}
        fullWidth
        variant={variant}
        {...rest}
      >
        {loading && loadingText ? loadingText : children}
      </Button>
    );
  }
);

SubmitButton.displayName = 'SubmitButton';
