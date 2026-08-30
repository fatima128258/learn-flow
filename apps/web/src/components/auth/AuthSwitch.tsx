'use client';
import React, { useState } from 'react';
import { AuthCard } from './AuthCard';
import { LoginForm, LoginFormData } from './LoginForm';
import { RegisterForm, RegisterFormData } from './RegisterForm';
import { getPostLoginRedirect } from '../../features/auth/postLoginRedirect';

export type AuthMode = 'login' | 'register';

export interface AuthSwitchProps {
  initialMode?: AuthMode;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

export const AuthSwitch: React.FC<AuthSwitchProps> = ({ initialMode = 'login' }) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const switchMode = (next: AuthMode) => {
    if (next === mode) return;
    setError(null);
    setSuccess(false);
    setMode(next);
  };

  const handleLogin = async (data: LoginFormData) => {
    setError(null);

    try {
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

  const handleRegister = async (data: RegisterFormData) => {
    setError(null);

    try {
      const res = await fetch(`${apiBase}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData?.error || 'Failed to create account');
      }

      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      throw err;
    }
  };

  const isLogin = mode === 'login';

  return (
    <AuthCard
      title={isLogin ? 'Welcome back' : 'Create your account'}
      description={
        isLogin
          ? 'Sign in to your LearnFlow account to continue your learning journey.'
          : 'Start learning, teaching, and growing with LearnFlow.'
      }
      footer={{
        text: isLogin ? "Don't have an account?" : 'Already have an account?',
        linkText: isLogin ? 'Sign up' : 'Sign in',
        linkOnClick: () => switchMode(isLogin ? 'register' : 'login')
      }}
    >
      <div key={mode} className="animate-form-switch">
        {isLogin ? (
          <LoginForm onSubmit={handleLogin} error={error} />
        ) : (
          <RegisterForm onSubmit={handleRegister} error={error} success={success} />
        )}
      </div>
    </AuthCard>
  );
};

AuthSwitch.displayName = 'AuthSwitch';