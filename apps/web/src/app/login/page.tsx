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
    if (user) {
      window.location.href = getPostLoginRedirect(user);
    }
  }, [user, isLoading]);

  // While checking auth, render nothing to avoid a flash of the login form
  if (isLoading || user) return null;

  return (
    <AuthLayout hideChrome>
      <AuthSwitch initialMode="login" />
    </AuthLayout>
  );
}
