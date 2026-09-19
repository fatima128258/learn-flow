'use client';
import React, { useEffect, useRef, useState } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthCard } from '../../components/auth/AuthCard';
import { Input } from '../../components/ui/Input';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { Stack } from '../../components/ui/layout/Stack';
import { useSubmitState } from '../../lib/useSubmitState';
import { useToast } from '../../components/ui/ToastProvider';
import { getForgotPasswordErrorMessage } from '../../features/auth/authErrors';
import { isValidEmail, normalizeEmail } from '../../lib/validation';

const REQUEST_TIMEOUT_MS = 15000;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [success, setSuccess] = useState(false);
  const [emailError, setEmailError] = useState<string>('');
  const [codeError, setCodeError] = useState<string>('');
  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([]);
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
      const res = await fetchWithTimeout(`${apiBase}/api/v1/auth/forgot-password`, {
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

  const verifyCode = async (value: string) => {
    if (isSubmitting) return;
    if (!/^\d{6}$/.test(value)) {
      setCodeError('Please enter a valid 6-digit code');
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setCodeError('');
    await submit(async () => {
      const apiBase = '';
      const res = await fetchWithTimeout(`${apiBase}/api/v1/auth/forgot-password/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizeEmail(email), code: value }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(getForgotPasswordErrorMessage(data?.error));
      }

      window.location.href = '/reset-password';
    });
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyCode(code.trim());
  };

  const handleCodeChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, '');
    const nextCode = code.split('');
    if (!digits) {
      nextCode[index] = '';
      setCode(nextCode.join('').slice(0, 6));
      setCodeError('');
      return;
    }

    digits.slice(0, 6 - index).split('').forEach((digit, offset) => {
      nextCode[index + offset] = digit;
    });
    const nextValue = nextCode.join('').slice(0, 6);
    setCode(nextValue);
    setCodeError('');

    const nextFocusIndex = Math.min(index + digits.length, 5);
    codeInputRefs.current[nextFocusIndex]?.focus();
    if (nextValue.length === 6) void verifyCode(nextValue);
  };

  const handleCodeKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendCode = async () => {
    if (isSubmitting) return;
    await submit(async () => {
      const res = await fetchWithTimeout('/api/v1/auth/forgot-password/resend', {
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
              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700" htmlFor="verification-code-0">
                  Verification code
                </label>
                <div className="flex gap-2 sm:gap-3" role="group" aria-label="Verification code">
                  {Array.from({ length: 6 }, (_, index) => (
                    <input
                      key={index}
                      ref={(element) => { codeInputRefs.current[index] = element; }}
                      id={`verification-code-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={code[index] ?? ''}
                      onChange={(event) => handleCodeChange(index, event.target.value)}
                      onKeyDown={(event) => handleCodeKeyDown(index, event)}
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      disabled={isSubmitting}
                      aria-label={`Verification digit ${index + 1}`}
                      className="h-14 min-w-0 flex-1 rounded-xl border border-[#e5d5c4] bg-[#fffdf9] text-center text-xl font-semibold text-[#17212b] outline-none transition focus:border-[#7a4a2e] focus:ring-2 focus:ring-[#a8784f]/20"
                    />
                  ))}
                </div>
                {codeError && <p className="mt-1.5 text-sm text-red-600">{codeError}</p>}
              </div>
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
