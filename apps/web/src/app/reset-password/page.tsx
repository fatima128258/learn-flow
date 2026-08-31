'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthCard } from '../../components/auth/AuthCard';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { PageLoader } from '../../components/ui/Spinner';
import { Stack } from '../../components/ui/layout/Stack';
import { useSubmitState } from '../../lib/useSubmitState';
import { useToast } from '../../components/ui/ToastProvider';
import { getResetPasswordErrorMessage } from '../../features/auth/authErrors';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const { isSubmitting, error, setError, submit } = useSubmitState();
  const toast = useToast();

  const [passwordError, setPasswordError] = useState<string>('');
  const [confirmPasswordError, setConfirmPasswordError] = useState<string>('');

  useEffect(() => {
    if (error) toast.error(error);
  }, [error, toast]);

  const validateForm = (): string | null => {
    setPasswordError('');
    setConfirmPasswordError('');

    if (!password) {
      setPasswordError('Password is required');
      return 'Password is required';
    }
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return 'Password must be at least 8 characters';
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      return 'Please confirm your password';
    }
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      return 'Passwords do not match';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || success) return;

    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    await submit(async () => {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(getResetPasswordErrorMessage(data?.error));
      }

      setSuccess(true);
      toast.success('Password reset successfully! Redirecting to login...');
      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    });
  };

  return (
    <AuthLayout hideChrome>
      <AuthCard
        title="Set new password"
        description="Enter your new password below."
        footer={{
          text: 'Remember your password?',
          linkText: 'Sign in',
          linkHref: '/login'
        }}
      >
        <form onSubmit={handleSubmit} noValidate>
          <Stack spacing="md">
            <PasswordInput
              label="New password"
              variant="line"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={passwordError}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              disabled={isSubmitting || success || !token}
              // helperText="Use at least 8 characters"
              required
            />

            <PasswordInput
              label="Confirm new password"
              variant="line"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={confirmPasswordError}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              disabled={isSubmitting || success || !token}
              required
            />

            <SubmitButton
              loading={isSubmitting}
              loadingText="Resetting password..."
              disabled={success || !token}
            >
              Reset password
            </SubmitButton>
          </Stack>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthLayout hideChrome><AuthCard title="Set new password" description="Loading..."><PageLoader label="Loading reset form..." compact /></AuthCard></AuthLayout>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
