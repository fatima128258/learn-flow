'use client';
import React, { useState } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthCard } from '../../components/auth/AuthCard';
import { Input } from '../../components/ui/Input';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { FormError } from '../../components/forms/FormError';
import { Alert } from '../../components/ui/Alert';
import { Stack } from '../../components/ui/layout/Stack';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [emailError, setEmailError] = useState<string>('');

  const validateEmail = () => {
    if (!email) {
      setEmailError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail()) {
      return;
    }

    setLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to send reset email');
      }

      setSuccess(true);
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
        title="Reset your password"
        description="Enter your email address and we'll send you a link to reset your password."
        footer={{
          text: 'Remember your password?',
          linkText: 'Sign in',
          linkHref: '/login'
        }}
      >
        <form onSubmit={handleSubmit} noValidate>
          <Stack spacing="md">
            {success && (
              <Alert variant="success" title="Check your email">
                If an account exists with that email, we've sent password reset instructions.
              </Alert>
            )}

            {error && <FormError message={error} />}

            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading || success}
              required
            />

            <SubmitButton
              loading={loading}
              loadingText="Sending..."
              disabled={success}
            >
              Send reset link
            </SubmitButton>
          </Stack>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
