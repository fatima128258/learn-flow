'use client';
import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { PasswordInput } from '../forms/PasswordInput';
import { SubmitButton } from '../forms/SubmitButton';
import { Stack } from '../ui/layout/Stack';
import { useToast } from '../ui/ToastProvider';
import { isValidEmail, normalizeEmail } from '../../lib/validation';

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

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setEmailError('Email is required');
      return 'Email is required';
    }
    if (!isValidEmail(email)) {
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
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return;

    try {
      await onSubmit({ name, email: normalizedEmail, password, confirmPassword });
    } catch {
      // API errors are surfaced by AuthSwitch via toast
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border-2 border-success-200 bg-success-50 p-6">
          <h3 className="text-lg font-semibold text-success-900">🎉 Welcome!</h3>
          <p className="mt-2 text-sm text-success-700">
            Your account has been created successfully.
          </p>
          <p className="mt-3 text-sm text-success-700">
            An admin will verify and approve your account shortly. Once approved, you'll be able to access the full platform.
          </p>
          <p className="mt-4 text-xs text-success-600">
            Please check your email for further instructions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack spacing="sm">
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
          className="!rounded-xl !border-[#e5d5c4] !bg-[#fffdf9] !px-4 !py-2.5 !text-[#17212b] focus:!border-[#7a4a2e] focus:!ring-[#a8784f]/20"
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
          className="!rounded-xl !border-[#e5d5c4] !bg-[#fffdf9] !px-4 !py-2.5 !text-[#17212b] focus:!border-[#7a4a2e] focus:!ring-[#a8784f]/20"
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
          // helperText="Use at least 8 characters"
          required
          className="!rounded-xl !border-[#e5d5c4] !bg-[#fffdf9] !px-4 !py-2.5 !text-[#17212b] focus:!border-[#7a4a2e] focus:!ring-[#a8784f]/20"
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
          className="!rounded-xl !border-[#e5d5c4] !bg-[#fffdf9] !px-4 !py-2.5 !text-[#17212b] focus:!border-[#7a4a2e] focus:!ring-[#a8784f]/20"
        />

        <SubmitButton
          loading={loading}
          loadingText="Creating account..."
          disabled={success}
          className="!rounded-xl !bg-[#5a321f] !py-3 !text-[#fff9f0] hover:!bg-[#7a4a2e] hover:!shadow-md"
        >
          Create Account
        </SubmitButton>
      </Stack>
    </form>
  );
};

RegisterForm.displayName = 'RegisterForm';
