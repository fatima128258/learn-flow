'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, ErrorState, Input, Skeleton } from '@/components/ui';
import { PasswordInput } from '@/components/forms/PasswordInput';
import { PageHeader, SectionHeader } from '@/components/dashboard';
import { useCurrentUser, meKey } from '@/features/auth/useCurrentUser';
import { ApiError, patchJson } from '@/lib/api';
import { getUpdateEmailErrorMessage, getChangePasswordErrorMessage } from '@/features/auth/settingsErrors';
import { useToast } from '@/components/ui/ToastProvider';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PasswordFieldErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmNewPassword?: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user, isLoading, error } = useCurrentUser();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [emailFieldError, setEmailFieldError] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<PasswordFieldErrors>({});
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (emailSubmitting || !user) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailFieldError('Please enter a new email address.');
      toast.error('Please enter a new email address.');
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setEmailFieldError('Please enter a valid email address.');
      toast.error('Please enter a valid email address.');
      return;
    }
    if (trimmedEmail.toLowerCase() === user.email.toLowerCase()) {
      setEmailFieldError('New email must be different from your current email.');
      toast.error('New email must be different from your current email.');
      return;
    }
    setEmailFieldError('');

    setEmailSubmitting(true);
    try {
      await patchJson('/api/v1/auth/me', { email: trimmedEmail });
      setEmail('');
      toast.success(
        'Your email address was updated and a verification link was sent to your new address.',
        'Email updated',
      );
      await queryClient.invalidateQueries({ queryKey: meKey });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      toast.error(getUpdateEmailErrorMessage(code));
    } finally {
      setEmailSubmitting(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (passwordSubmitting) return;

    const next: PasswordFieldErrors = {};
    if (!currentPassword) next.currentPassword = 'Please enter your current password.';
    if (!newPassword) next.newPassword = 'Please enter a new password.';
    else if (newPassword.length < 8) next.newPassword = 'New password must be at least 8 characters.';
    if (!confirmNewPassword) next.confirmNewPassword = 'Please confirm your new password.';
    else if (confirmNewPassword !== newPassword) next.confirmNewPassword = 'Passwords do not match.';
    setPasswordFieldErrors(next);

    const firstError = next.currentPassword ?? next.newPassword ?? next.confirmNewPassword;
    if (firstError) {
      toast.error(firstError);
      return;
    }

    setPasswordSubmitting(true);
    try {
      await patchJson('/api/v1/auth/password', {
        currentPassword,
        newPassword,
        confirmNewPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      toast.success('Your password was changed successfully.', 'Password updated');
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      toast.error(getChangePasswordErrorMessage(code));
    } finally {
      setPasswordSubmitting(false);
    }
  }

  if (isLoading && !user) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <div className="space-y-4">
            <Skeleton variant="text" height={24} width={180} />
            <Skeleton variant="text" height={24} width={320} />
            <Skeleton variant="text" height={24} width={280} />
          </div>
        </Card>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <ErrorState
            title="Unable to load your account settings"
            message="Sign in to manage your email and password."
            action={{ label: 'Go to login', onClick: () => router.push('/login') }}
          />
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <ErrorState
            title="Not signed in"
            message="Sign in to manage your email and password."
            action={{ label: 'Go to login', onClick: () => router.push('/login') }}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Settings"
      />

      {/* ── Email address ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-6 py-4">
          <SectionHeader
            title="Email Settings"
            description={`You are signed in as ${user.email}.`}
          />
        </div>
        <form onSubmit={handleEmailSubmit} noValidate className="space-y-4 p-6" aria-busy={emailSubmitting}>
          <Input
            label="New email address"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailFieldError) setEmailFieldError('');
            }}
            error={emailFieldError}
            placeholder="name@example.com"
            autoComplete="email"
            disabled={emailSubmitting}
          />

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="submit" loading={emailSubmitting} disabled={emailSubmitting}>
              {emailSubmitting ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>

      {/* ── Password ─────────────────────────────────────────────────── */}
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-6 py-4">
          <SectionHeader
            title="Password Setting"
            description="Use at least 8 characters. Other active sessions will be signed out."
          />
        </div>
        <form onSubmit={handlePasswordSubmit} noValidate className="space-y-4 p-6" aria-busy={passwordSubmitting}>
          <PasswordInput
            label="Current password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              if (passwordFieldErrors.currentPassword) {
                setPasswordFieldErrors((prev) => ({ ...prev, currentPassword: undefined }));
              }
            }}
            error={passwordFieldErrors.currentPassword}
            placeholder="Enter your current password"
            autoComplete="current-password"
            disabled={passwordSubmitting}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordInput
              label="New password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (passwordFieldErrors.newPassword) {
                  setPasswordFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
                }
              }}
              error={passwordFieldErrors.newPassword}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              disabled={passwordSubmitting}
              required
            />
            <PasswordInput
              label="Confirm new password"
              value={confirmNewPassword}
              onChange={(e) => {
                setConfirmNewPassword(e.target.value);
                if (passwordFieldErrors.confirmNewPassword) {
                  setPasswordFieldErrors((prev) => ({ ...prev, confirmNewPassword: undefined }));
                }
              }}
              error={passwordFieldErrors.confirmNewPassword}
              placeholder="Re-enter new password"
              autoComplete="new-password"
              disabled={passwordSubmitting}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="submit" loading={passwordSubmitting} disabled={passwordSubmitting}>
              {passwordSubmitting ? 'Saving...' : 'Update password'}
            </Button>
          </div>
        </form>
      </div>

      {user.role === 'ORG_ADMIN' && (
        <div className="mt-6">
          <p className="text-sm text-neutral-500">
            Organization profile and preferences are managed separately.{' '}
            <Link
              href="/dashboard/organization/settings"
              className="font-medium text-primary-600 hover:text-primary-700"
            >
              Manage organization settings
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
