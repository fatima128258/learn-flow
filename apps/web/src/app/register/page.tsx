'use client';
import React, { useEffect } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthSwitch } from '../../components/auth/AuthSwitch';
import { useCurrentUser } from '../../features/auth/useCurrentUser';
import { getPostLoginRedirect } from '../../features/auth/postLoginRedirect';

export default function RegisterPage() {
  const { data: user, isLoading } = useCurrentUser();

  // Only redirect if user is FULLY PROVISIONED (has role and organizationId)
  // Allow unprovisioned users to stay on register page (they can create more accounts if needed)
  // Allow unauthenticated users to stay on register page (normal signup flow)
  useEffect(() => {
    if (isLoading) return;
    if (user?.role && user?.organizationId) {
      window.location.href = getPostLoginRedirect(user);
    }
  }, [user, isLoading]);

  // While checking auth, render nothing to avoid a flash of the register form
  if (isLoading) return null;

  return (
    <AuthLayout hideChrome>
      <AuthSwitch initialMode="register" />
    </AuthLayout>
  );
}
