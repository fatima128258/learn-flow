'use client';
import React, { useState } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthCard } from '../../components/auth/AuthCard';
import { LoginForm, LoginFormData } from '../../components/auth/LoginForm';
import { getPostLoginRedirect } from '../../features/auth/postLoginRedirect';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (data: LoginFormData) => {
    setError(null);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData?.error || 'Invalid email or password');
      }

      window.location.href = getPostLoginRedirect(responseData?.user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      throw err;
    }
  };

  return (
    <AuthLayout>
      <AuthCard
        title="Welcome back"
        description="Sign in to your LearnFlow account to continue your learning journey."
        footer={{
          text: "Don't have an account?",
          linkText: 'Sign up',
          linkHref: '/register'
        }}
      >
        <LoginForm onSubmit={handleLogin} error={error} />
      </AuthCard>
    </AuthLayout>
  );
}
