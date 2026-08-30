'use client';
import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { PasswordInput } from '../forms/PasswordInput';
import { SubmitButton } from '../forms/SubmitButton';
import { FormError } from '../forms/FormError';
import { Alert } from '../ui/Alert';
import { Stack } from '../ui/layout/Stack';

export interface RegisterFormProps {
  onSubmit: (data: RegisterFormData) => Promise<void>;
  error?: string | null;
  success?: boolean;
}

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSubmit,
  error: externalError,
  success,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nameError, setNameError] = useState<string>('');
  const [emailError, setEmailError] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [confirmPasswordError, setConfirmPasswordError] = useState<string>('');

  const validateForm = (): boolean => {
    let isValid = true;
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');

    if (!name.trim()) {
      setNameError('Name is required');
      isValid = false;
    } else if (name.trim().length < 2) {
      setNameError('Name must be at least 2 characters');
      isValid = false;
    }

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
    if (loading || success) {
      return;
    }
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit({ name, email, password, confirmPassword });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const displayError = error || externalError;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack spacing="md">
        {success && (
          <Alert variant="success" title="Account created successfully!">
            You can now sign in with your credentials.
          </Alert>
        )}

        {displayError && <FormError message={displayError} />}

        <Input
          label="Full name"
          type="text"
          variant="line"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
          placeholder="John Doe"
          autoComplete="name"
          disabled={loading || success}
          required
        />

        <Input
          label="Email address"
          type="email"
          variant="line"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={loading || success}
          required
        />

        <PasswordInput
          label="Password"
          variant="line"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          disabled={loading || success}
          helperText="Use at least 8 characters"
          required
        />

        <PasswordInput
          label="Confirm password"
          variant="line"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={confirmPasswordError}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          disabled={loading || success}
          required
        />

        <SubmitButton
          loading={loading}
          loadingText="Creating account..."
          disabled={success}
        >
          Create account
        </SubmitButton>
      </Stack>
    </form>
  );
};

RegisterForm.displayName = 'RegisterForm';
