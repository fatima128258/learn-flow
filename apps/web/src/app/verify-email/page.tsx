'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthCard } from '../../components/auth/AuthCard';
import { Alert } from '../../components/ui/Alert';
import { Stack } from '../../components/ui/layout/Stack';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { PageLoader } from '../../components/ui/Spinner';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const verifyEmail = async () => {
    if (!token) {
      setError('Invalid or missing verification token');
      setLoading(false);
      return;
    }

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/v1/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'TOKEN_EXPIRED') {
          throw new Error('This verification link has expired. Please request a new one.');
        }
        if (data.error === 'TOKEN_ALREADY_USED') {
          throw new Error('This email has already been verified.');
        }
        if (data.error === 'INVALID_TOKEN') {
          throw new Error('Invalid verification link.');
        }
        throw new Error(data?.error || 'Failed to verify email');
      }

      setSuccess(true);
      // Redirect to home after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => { await verifyEmail(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthLayout>
      <AuthCard
        title="Email Verification"
        description={loading ? 'Verifying your email address...' : ''}
        footer={{
          text: 'Need help?',
          linkText: 'Contact support',
          linkHref: '/contact'
        }}
      >
        <Stack spacing="md">
          {loading && <PageLoader label="Verifying your email address..." compact />}

          {success && (
            <Alert variant="success" title="Email verified successfully!">
              Your email has been verified. Redirecting...
            </Alert>
          )}

          {error && (
            <Alert variant="error" title="Verification failed">
              {error}
            </Alert>
          )}

          {!loading && !success && (
            <SubmitButton onClick={() => window.location.href = '/login'}>
              Go to login
            </SubmitButton>
          )}
        </Stack>
      </AuthCard>
    </AuthLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthLayout><AuthCard title="Verifying email" description="Loading..."><PageLoader label="Loading verification..." compact /></AuthCard></AuthLayout>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
