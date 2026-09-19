'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, ErrorState, Input, Spinner } from '@/components/ui';
import { PasswordInput } from '@/components/forms/PasswordInput';
import { SectionHeader } from '@/components/dashboard';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { ApiError, getJson, logout, patchJson } from '@/lib/api';
import { getUpdateEmailErrorMessage, getChangePasswordErrorMessage } from '@/features/auth/settingsErrors';
import { useToast } from '@/components/ui/ToastProvider';
import { isValidEmail } from '@/lib/validation';

type PasswordFieldErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmNewPassword?: string;
};

type PaymentDetails = {
  id: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string;
};

type PaymentDetailsForm = Omit<PaymentDetails, 'id'>;

const emptyPaymentDetails: PaymentDetailsForm = {
  bankName: '',
  accountTitle: '',
  accountNumber: '',
  iban: '',
};

function maskSensitive(value: string) {
  if (value.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
}

export default function SettingsPage() {
  const router = useRouter();
  const { data: user, isLoading, error } = useCurrentUser();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [emailFieldError, setEmailFieldError] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailEditing, setEmailEditing] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<PasswordFieldErrors>({});
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentDetailsForm>(emptyPaymentDetails);
  const [paymentEditing, setPaymentEditing] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    if ((user?.role !== 'INSTRUCTOR' && user?.role !== 'ORG_ADMIN') || !user.organizationId) return;
    let active = true;
    setPaymentLoading(true);
    const paymentDetailsPath = user.role === 'ORG_ADMIN'
      ? '/api/v1/organizations/org/payment-details'
      : `/api/v1/organizations/${user.organizationId}/instructor/payment-details`;
    getJson<{ data: PaymentDetails | null }>(
      paymentDetailsPath,
    )
      .then((response) => {
        if (!active) return;
        setPaymentDetails(response.data);
        if (response.data) {
          setPaymentForm({
            bankName: response.data.bankName,
            accountTitle: '',
            accountNumber: '',
            iban: '',
          });
        }
      })
      .catch(() => {
        if (active) setPaymentError('Could not load your payment details.');
      })
      .finally(() => {
        if (active) setPaymentLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  async function savePaymentDetails() {
    if (!user?.organizationId) return;
    const values = Object.fromEntries(
      Object.entries(paymentForm).map(([key, value]) => [key, value.trim()]),
    ) as PaymentDetailsForm;
    if (!values.bankName || (paymentDetails === null && !values.accountNumber)) {
      setPaymentError('Please complete all payment detail fields.');
      return;
    }
    setPaymentSubmitting(true);
    setPaymentError(null);
    try {
      const paymentDetailsPath = user.role === 'ORG_ADMIN'
        ? '/api/v1/organizations/org/payment-details'
        : `/api/v1/organizations/${user.organizationId}/instructor/payment-details`;
      const response = await patchJson<{ data: PaymentDetails }>(
        paymentDetailsPath,
        {
          bankName: values.bankName,
          ...(values.accountNumber ? { accountNumber: values.accountNumber } : {}),
        },
      );
      setPaymentDetails(response.data);
      setPaymentForm({
        bankName: response.data.bankName,
        accountTitle: '',
        accountNumber: '',
        iban: '',
      });
      setPaymentEditing(false);
      toast.success('Payment details saved.', 'Payment details updated');
    } catch {
      setPaymentError('Could not save your payment details. Please try again.');
    } finally {
      setPaymentSubmitting(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (emailSubmitting || !user) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailFieldError('Please enter a new email address.');
      toast.error('Please enter a new email address.');
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
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
      const response = await patchJson<{ user?: { emailVerified?: boolean } }>('/api/v1/auth/me', { email: trimmedEmail });
      setEmail('');
      setEmailEditing(false);
      const emailVerified = response.user?.emailVerified === true;
      toast.success(
        emailVerified
          ? 'Your email address was updated successfully.'
          : 'Your email address was updated and a verification link was sent to your new address.',
        'Email updated',
      );
      await logout();
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
      await logout();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      toast.error(getChangePasswordErrorMessage(code));
    } finally {
      setPasswordSubmitting(false);
    }
  }

  if (isLoading && !user) {
    return (
      <div className="flex min-h-64 items-center justify-center" role="status" aria-label="Loading settings">
        <Spinner size="md" label="Loading..." />
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
      {/* ── Email address ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-6 py-4">
          <SectionHeader
            title="Email Settings"
            description={`You are signed in as ${user.email}.`}
          />
        </div>
        {!emailEditing ? (
          <div className="flex items-end justify-between gap-4 p-6">
            <div>
              <p className="text-sm font-medium text-neutral-700">Current email address</p>
              <p className="mt-2 text-sm text-neutral-900">{user.email}</p>
            </div>
            <Button
              type="button"
              onClick={() => {
                setEmail(user.email);
                setEmailFieldError('');
                setEmailEditing(true);
              }}
            >
              Edit
            </Button>
          </div>
        ) : (
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEmail('');
                  setEmailFieldError('');
                  setEmailEditing(false);
                }}
                disabled={emailSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" loading={emailSubmitting} disabled={emailSubmitting}>
                {emailSubmitting ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </form>
        )}
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

      {(user.role === 'INSTRUCTOR' || user.role === 'ORG_ADMIN') && (
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
            <SectionHeader
              title="Bank Settings"
              description="Add the bank name and account number where your course payments should be settled."
            />
            {paymentDetails && !paymentEditing && (
              <Button variant="ghost" onClick={() => setPaymentEditing(true)}>
                Edit
              </Button>
            )}
          </div>
          <div className="p-6">
            {paymentLoading ? (
              <div className="flex min-h-24 items-center justify-center" role="status" aria-label="Loading payment details">
                <Spinner size="md" label="Loading..." />
              </div>
            ) : paymentError && !paymentEditing ? (
              <ErrorState title="Unable to load payment details" message={paymentError} />
            ) : !paymentDetails && !paymentEditing ? (
              <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
                <p className="text-sm text-neutral-600">No payment details have been added yet.</p>
                <Button className="mt-4" onClick={() => setPaymentEditing(true)}>
                  Add Payment Details
                </Button>
              </div>
            ) : paymentEditing ? (
              <div className="space-y-4">
                {([
                  ['bankName', 'Bank Name'],
                  ['accountNumber', 'Account Number'],
                ] as const).map(([field, label]) => (
                  <Input
                    key={field}
                    label={label}
                    value={paymentForm[field]}
                    onChange={(event) => setPaymentForm((current) => ({ ...current, [field]: event.target.value }))}
                    autoComplete="off"
                    disabled={paymentSubmitting}
                  />
                ))}
                {paymentError && <p className="text-sm text-error-700">{paymentError}</p>}
                <div className="flex justify-end gap-3 pt-2">
                  {paymentDetails && (
                    <Button variant="ghost" onClick={() => setPaymentEditing(false)} disabled={paymentSubmitting}>
                      Cancel
                    </Button>
                  )}
                  <Button onClick={() => void savePaymentDetails()} loading={paymentSubmitting} loadingText="Saving...">
                    Save Payment Details
                  </Button>
                </div>
              </div>
            ) : paymentDetails ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <div><dt className="text-sm text-neutral-500">Bank Name</dt><dd className="mt-1 font-medium text-neutral-900">{paymentDetails.bankName}</dd></div>
                <div><dt className="text-sm text-neutral-500">Account Number</dt><dd className="mt-1 font-medium text-neutral-900">{maskSensitive(paymentDetails.accountNumber)}</dd></div>
              </dl>
            ) : null}
          </div>
        </div>
      )}

    </div>
  );
}
