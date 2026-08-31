'use client';
import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { PasswordInput } from '../forms/PasswordInput';
import { SubmitButton } from '../forms/SubmitButton';
import { Stack } from '../ui/layout/Stack';
import { useToast } from '../ui/ToastProvider';

export interface RegisterFormProps {
  onSubmit: (data: RegisterFormData) => Promise<void>;
  success?: boolean;
}

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSubmit,
  success,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const [nameError, setNameError] = useState<string>('');
  const [emailError, setEmailError] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [confirmPasswordError, setConfirmPasswordError] = useState<string>('');

  const validateForm = (): string | null => {
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');

    if (!name.trim()) {
      setNameError('Name is required');
      return 'Name is required';
    }
    if (name.trim().length < 2) {
      setNameError('Name must be at least 2 characters');
      return 'Name must be at least 2 characters';
    }

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
    if (loading || success) {
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    try {
      await onSubmit({ name, email, password, confirmPassword });
    } catch {
      // API errors are surfaced by AuthSwitch via toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack spacing="md">
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
