'use client';
import React, { useEffect } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthSwitch } from '../../components/auth/AuthSwitch';
import { useCurrentUser } from '../../features/auth/useCurrentUser';
import { getPostLoginRedirect } from '../../features/auth/postLoginRedirect';

export default function LoginPage() {
  const { data: user, isLoading } = useCurrentUser();

  useEffect(() => {
    if (isLoading) return;
    // Only redirect if user is FULLY PROVISIONED (has role and organizationId)
    // Allow unprovisioned users to stay on login page (they can navigate from welcome)
    // Allow unauthenticated users to stay on login page (normal login flow)
    if (user?.role && user?.organizationId) {
      window.location.href = getPostLoginRedirect(user);
    }
  }, [user, isLoading]);

  // While checking auth, render nothing to avoid a flash of the login form
  if (isLoading) return null;

  return (
    <AuthLayout hideChrome>
      <AuthSwitch initialMode="login" />
    </AuthLayout>
  );
}
