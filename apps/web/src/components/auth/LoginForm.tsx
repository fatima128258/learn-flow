'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Input } from '../ui/Input';
import { PasswordInput } from '../forms/PasswordInput';
import { SubmitButton } from '../forms/SubmitButton';
import { FormError } from '../forms/FormError';
import { Stack } from '../ui/layout/Stack';
import { useSubmitState } from '../../lib/useSubmitState';

export interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void>;
  error?: string | null;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, error: externalError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { isSubmitting, error, submit } = useSubmitState();

  const [emailError, setEmailError] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');

  const validateForm = (): boolean => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');

    if (!email) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateForm()) return;

    await submit(async () => {
      await onSubmit({ email, password });
    });
  };

  const displayError = error || externalError;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack spacing="md">
        {displayError && <FormError message={displayError} />}

        <Input
          label="Email address"
          type="email"
          variant="line"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={isSubmitting}
          required
        />

        <PasswordInput
          label="Password"
          variant="line"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError}
          placeholder="Enter your password"
          autoComplete="current-password"
          disabled={isSubmitting}
          required
        />

        <div className="flex items-center justify-end -mt-2">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <SubmitButton
          loading={isSubmitting}
          loadingText="Signing in..."
        >
          Sign in
        </SubmitButton>
      </Stack>
    </form>
  );
};

LoginForm.displayName = 'LoginForm';
