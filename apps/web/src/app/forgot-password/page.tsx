'use client';
import React, { useState } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthCard } from '../../components/auth/AuthCard';
import { Input } from '../../components/ui/Input';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { FormError } from '../../components/forms/FormError';
import { Alert } from '../../components/ui/Alert';
import { Stack } from '../../components/ui/layout/Stack';
import { useSubmitState } from '../../lib/useSubmitState';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const [emailError, setEmailError] = useState<string>('');
  const { isSubmitting, error, submit } = useSubmitState();

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
    if (isSubmitting || success) return;

    if (!validateEmail()) {
      return;
    }

    await submit(async () => {
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
    });
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
                If an account exists with that email, we&apos;ve sent password reset instructions.
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
              disabled={isSubmitting || success}
              required
            />

            <SubmitButton
              loading={isSubmitting}
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
