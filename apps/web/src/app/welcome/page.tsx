'use client';
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthCard } from '../../components/auth/AuthCard';
import { Alert } from '../../components/ui/Alert';
import { Stack } from '../../components/ui/layout/Stack';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/Spinner';
import { useCurrentUser } from '../../features/auth/useCurrentUser';
import { getPostLoginRedirect } from '../../features/auth/postLoginRedirect';

function WelcomeContent() {
  const { data: user, isLoading: userLoading, error: userError } = useCurrentUser();
  const searchParams = useSearchParams();
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  // Get user data from query params (from registration) or from auth context
  const registeredEmail = searchParams.get('email') || user?.email || '';
  const registeredName = searchParams.get('name') || user?.name || '';
  const isVerified = user?.emailVerified ?? false;

  // If no user and no query params after loading completes, redirect to login
  // But allow showing the welcome page with query params even if auth hasn't loaded yet
  useEffect(() => {
    if (!userLoading && !user && !registeredEmail) {
      window.location.href = '/login';
    }
  }, [userLoading, user, registeredEmail]);

  const handleResendVerification = async () => {
    setResending(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || '';
      const res = await fetch(`${apiBase}/api/v1/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error === 'TOO_MANY_ATTEMPTS') {
          throw new Error('Too many attempts. Please try again in a few minutes.');
        }
        throw new Error('Failed to resend verification email');
      }

      setResendSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resend verification email';
      setResendError(message);
    } finally {
      setResending(false);
    }
  };

  const handleContinue = () => {
    if (user?.role && user?.organizationId) {
      // User has role and organization, redirect to their appropriate dashboard
      window.location.href = getPostLoginRedirect(user);
    } else if (user) {
      // User is authenticated but hasn't been assigned to an organization yet
      // Send them to the home page to browse public content
      window.location.href = '/';
    } else {
      // No session yet, redirect to login
      window.location.href = '/login';
    }
  };

  if (userLoading && !registeredEmail) {
    // Only show loading if we don't have query params to fall back on
    return (
      <AuthLayout hideChrome>
        <AuthCard title="Welcome" description="Loading your account details...">
          <PageLoader label="Loading..." compact />
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout hideChrome>
      <AuthCard
        title="🎉 Account Created Successfully!"
        description="Welcome to LearnFlow – your learning journey starts here."
        footer={
          isVerified
            ? undefined
            : {
                text: 'Wrong email address?',
                linkText: 'Contact support',
                linkHref: '/contact',
              }
        }
      >
        <Stack spacing="lg">
          {/* Success confirmation */}
          <Alert variant="success" title="Your account is ready">
            Your LearnFlow account has been created successfully.
          </Alert>

          {/* Account details */}
          <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div>
              <div className="text-sm font-medium text-neutral-600">Account Name</div>
              <div className="text-base font-semibold text-neutral-900">{registeredName || 'Student'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-neutral-600">Email Address</div>
              <div className="text-base font-medium text-neutral-900">{registeredEmail}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-neutral-600">Account Type</div>
              <div className="text-base font-medium text-neutral-900">
                {user?.role === 'PLATFORM_ADMIN'
                  ? 'Platform Administrator'
                  : user?.role === 'ORG_ADMIN'
                    ? 'Organization Administrator'
                    : user?.role === 'INSTRUCTOR'
                      ? 'Instructor'
                      : user?.role === 'STUDENT'
                        ? 'Student'
                        : 'Student (Default)'}
              </div>
            </div>
          </div>



          {/* What happens next */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">What happens next?</h3>
            {user?.role && user?.organizationId ? (
              <ul className="space-y-2 text-sm text-neutral-700">
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Access your organization's course catalog</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Enroll in courses and start learning at your own pace</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Track your progress and earn certificates</span>
                </li>
                {!isVerified && (
                  <li className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">Don't forget to verify your email to unlock all features</span>
                  </li>
                )}
              </ul>
            ) : (
              <ul className="space-y-2 text-sm text-neutral-700">
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">You'll need to be added to an organization to access courses</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Wait for an organization administrator to invite you</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Or contact support to join an existing organization</span>
                </li>
                {!isVerified && (
                  <li className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">Verify your email address to complete your account setup</span>
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* CTA button */}
          <SubmitButton onClick={handleContinue}>
            {user?.role && user?.organizationId
              ? isVerified
                ? 'Go to Dashboard'
                : 'Continue to Dashboard'
              : user
                ? 'Continue to Home'
                : 'Sign in to Continue'}
          </SubmitButton>

          {/* Additional Navigation Options */}
          <div className="border-t border-neutral-200 pt-4">
            <p className="mb-3 text-center text-sm text-neutral-600">Other options:</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => (window.location.href = '/')}
              >
                Back to Home
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => (window.location.href = '/login')}
              >
                Sign In
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => (window.location.href = '/register')}
              >
                Create Account
              </Button>
            </div>
          </div>
        </Stack>
      </AuthCard>
    </AuthLayout>
  );
}

export default function WelcomePage() {
  return (
    <Suspense
      fallback={
        <AuthLayout hideChrome>
          <AuthCard title="Welcome" description="Loading...">
            <PageLoader label="Loading..." compact />
          </AuthCard>
        </AuthLayout>
      }
    >
      <WelcomeContent />
    </Suspense>
  );
}
