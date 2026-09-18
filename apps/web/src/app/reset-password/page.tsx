'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthCard } from '../../components/auth/AuthCard';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { PageLoading } from '../../components/ui/Spinner';
import { Stack } from '../../components/ui/layout/Stack';
import { useSubmitState } from '../../lib/useSubmitState';
import { useToast } from '../../components/ui/ToastProvider';
import { getResetPasswordErrorMessage } from '../../features/auth/authErrors';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const { isSubmitting, error, submit } = useSubmitState();
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

    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    await submit(async () => {
      const apiBase = '';
      const res = await fetch(`${apiBase}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(getResetPasswordErrorMessage(data?.error));
      }

      setSuccess(true);
      toast.success('Password reset successfully! Redirecting to login...');
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
              disabled={isSubmitting || success}
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
              disabled={isSubmitting || success}
              required
            />

            <SubmitButton
              loading={isSubmitting}
              loadingText="Resetting password..."
              disabled={success}
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
    <Suspense fallback={<AuthLayout hideChrome><AuthCard title="Set new password" description="Loading..."><PageLoading /></AuthCard></AuthLayout>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
