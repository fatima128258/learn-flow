'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Input } from '../ui/Input';
import { PasswordInput } from '../forms/PasswordInput';
import { SubmitButton } from '../forms/SubmitButton';
import { Stack } from '../ui/layout/Stack';
import { useToast } from '../ui/ToastProvider';

export interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void>;
}

export interface LoginFormData {
  email: string;
  password: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LoginForm: React.FC<LoginFormProps> = ({ onSubmit }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const [emailError, setEmailError] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');

  const validateForm = (): string | null => {
    setEmailError('');
    setPasswordError('');

    if (!email) {
      setEmailError('Email is required');
      return 'Email is required';
    }
    if (!EMAIL_RE.test(email)) {
      setEmailError('Please enter a valid email address');
      return 'Please enter a valid email address';
    }
    if (!password) {
      setPasswordError('Password is required');
      return 'Password is required';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ email, password });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack spacing="md">
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
