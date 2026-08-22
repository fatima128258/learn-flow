'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthCard } from '../../components/auth/AuthCard';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { FormError } from '../../components/forms/FormError';
import { Alert } from '../../components/ui/Alert';
import { Stack } from '../../components/ui/layout/Stack';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [passwordError, setPasswordError] = useState<string>('');
  const [confirmPasswordError, setConfirmPasswordError] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token');
    }
  }, [token]);

  const validateForm = () => {
    let isValid = true;
    setPasswordError('');
    setConfirmPasswordError('');

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      isValid = false;
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'TOKEN_EXPIRED') {
          throw new Error('This reset link has expired. Please request a new one.');
        }
        if (data.error === 'TOKEN_ALREADY_USED') {
          throw new Error('This reset link has already been used.');
        }
        if (data.error === 'INVALID_TOKEN') {
          throw new Error('Invalid reset link.');
        }
        throw new Error(data?.error || 'Failed to reset password');
      }

      setSuccess(true);
      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
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
            {success && (
              <Alert variant="success" title="Password reset successfully!">
                Redirecting to login...
              </Alert>
            )}

            {error && <FormError message={error} />}

            <PasswordInput
              label="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={passwordError}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              disabled={loading || success || !token}
              helperText="Use at least 8 characters"
              required
            />

            <PasswordInput
              label="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={confirmPasswordError}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              disabled={loading || success || !token}
              required
            />

            <SubmitButton
              loading={loading}
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
