'use client';
import React, { useEffect } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthSwitch } from '../../components/auth/AuthSwitch';
import { useCurrentUser } from '../../features/auth/useCurrentUser';
import { getPostLoginRedirect } from '../../features/auth/postLoginRedirect';

export default function RegisterPage() {
  const { data: user, isLoading } = useCurrentUser();

  useEffect(() => {
    if (isLoading) return;
    // Only redirect if user is FULLY PROVISIONED (has role and organizationId).
    // Unauthenticated users and unprovisioned users stay on the register page.
    if (user?.role && user?.organizationId) {
      window.location.href = getPostLoginRedirect(user);
    }
  }, [user, isLoading]);

  // Always render the register form immediately — do not wait for the /auth/me
  // check to complete. The useEffect above handles the redirect for users who
  // are already authenticated. Blocking render on isLoading caused a confirmed
  // blank/white-screen in production while the /auth/me round-trip completed.
  return (
    <AuthLayout hideChrome>
      <AuthSwitch initialMode="register" />
    </AuthLayout>
  );
}
