'use client';
import React, { useEffect, useState } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthCard } from '../../components/auth/AuthCard';
import { Input } from '../../components/ui/Input';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { Alert } from '../../components/ui/Alert';
import { Stack } from '../../components/ui/layout/Stack';
import { useSubmitState } from '../../lib/useSubmitState';
import { useToast } from '../../components/ui/ToastProvider';
import { getForgotPasswordErrorMessage } from '../../features/auth/authErrors';
import { isValidEmail, normalizeEmail } from '../../lib/validation';


export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [success, setSuccess] = useState(false);
  const [emailError, setEmailError] = useState<string>('');
  const [codeError, setCodeError] = useState<string>('');
  const { isSubmitting, error, submit } = useSubmitState();
  const toast = useToast();

  useEffect(() => {
    if (error) toast.error(error);
  }, [error, toast]);

  const validateEmail = (): string | null => {
    if (!email.trim()) {
      setEmailError('Email is required');
      return 'Email is required';
    }
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      return 'Please enter a valid email address';
    }
    setEmailError('');
    return null;
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || success) return;

    const validationError = validateEmail();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    await submit(async () => {
      const apiBase = '';
      const res = await fetch(`${apiBase}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizeEmail(email) }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(getForgotPasswordErrorMessage(data?.error));
      }

      setSuccess(true);
      setStep('verify');
    });
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!/^\d{6}$/.test(code.trim())) {
      setCodeError('Please enter a valid 6-digit code');
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setCodeError('');
    await submit(async () => {
      const apiBase = '';
      const res = await fetch(`${apiBase}/api/v1/auth/forgot-password/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizeEmail(email), code: code.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(getForgotPasswordErrorMessage(data?.error));
      }

      window.location.href = '/reset-password';
    });
  };

  const handleResendCode = async () => {
    if (isSubmitting) return;
    await submit(async () => {
      const res = await fetch('/api/v1/auth/forgot-password/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizeEmail(email) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(getForgotPasswordErrorMessage(data?.error));
      toast.success('If an account exists with that email, a new code has been sent.');
    });
  };

  return (
    <AuthLayout hideChrome>
      <AuthCard
        title={step === 'email' ? 'Forgot Password' : 'Enter verification code'}
        description={step === 'email'
          ? 'Enter your email address and we will send a verification code.'
          : 'We sent a 6-digit code to your email address.'}
        footer={{
          text: 'Remember your password?',
          linkText: 'Sign in',
          linkHref: '/login'
        }}
      >
        <form onSubmit={step === 'email' ? handleRequestCode : handleVerifyCode} noValidate>
          <Stack spacing="md">
            {success && step === 'verify' && (
              <Alert variant="success" title="Check your email">
                If an account exists with that email, we&apos;ve sent a verification code.
              </Alert>
            )}

            {step === 'email' ? (
              <Input
                label="Email address"
                type="email"
                variant="line"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={emailError}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isSubmitting || success}
                required
              />
            ) : (
              <Input
                label="Verification code"
                type="text"
                inputMode="numeric"
                variant="line"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                error={codeError}
                placeholder="123456"
                autoComplete="one-time-code"
                disabled={isSubmitting}
                required
              />
            )}

            <SubmitButton
              loading={isSubmitting}
              loadingText={step === 'email' ? 'Sending...' : 'Verifying...'}
              disabled={success && step === 'email'}
            >
              {step === 'email' ? 'Send Verification Code' : 'Verify Code'}
            </SubmitButton>
            {step === 'verify' && (
              <button type="button" className="text-sm font-medium text-[#7a4a2e]" onClick={handleResendCode} disabled={isSubmitting}>
                Resend Code
              </button>
            )}
          </Stack>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
