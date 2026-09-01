'use client';
import React, { useEffect } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthSwitch } from '../../components/auth/AuthSwitch';
import { useCurrentUser } from '../../features/auth/useCurrentUser';
import { getPostLoginRedirect } from '../../features/auth/postLoginRedirect';

export default function RegisterPage() {
  const { data: user, isLoading } = useCurrentUser();

  // If already authenticated, redirect to appropriate dashboard
  // But don't interfere with the registration flow - user might be on the welcome page
  useEffect(() => {
    if (isLoading) return;
    if (user) {
      // Check if we're navigating back to /register after successful registration
      // In that case, redirect to the welcome page instead
      window.location.href = getPostLoginRedirect(user);
    }
  }, [user, isLoading]);

  // While checking auth, render nothing to avoid a flash of the register form
  if (isLoading || user) return null;

  return (
    <AuthLayout hideChrome>
      <AuthSwitch initialMode="register" />
    </AuthLayout>
  );
}
