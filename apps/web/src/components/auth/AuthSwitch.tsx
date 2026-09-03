'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthCard } from './AuthCard';
import { LoginForm, LoginFormData } from './LoginForm';
import { RegisterForm, RegisterFormData } from './RegisterForm';
import { getPostLoginRedirect } from '../../features/auth/postLoginRedirect';
import { getLoginErrorMessage, getRegisterErrorMessage } from '../../features/auth/authErrors';
import { useToast } from '../ui/ToastProvider';

export type AuthMode = 'login' | 'register';

export interface AuthSwitchProps {
  initialMode?: AuthMode;
}

const apiBase = '';

export const AuthSwitch: React.FC<AuthSwitchProps> = ({ initialMode = 'login' }) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [success, setSuccess] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const switchMode = (next: AuthMode) => {
    if (next === mode) return;
    setSuccess(false);
    setMode(next);
  };

  const handleLogin = async (data: LoginFormData) => {
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      const responseData = await res.json();

      if (!res.ok) {
        toast.error(getLoginErrorMessage(responseData?.error));
        return;
      }

      toast.success('Signed in successfully. Redirecting...');
      // Use Next.js client-side navigation instead of full-page reload
      // This preserves React Query cache and eliminates redundant /auth/me calls
      router.push(getPostLoginRedirect(responseData?.user));
    } catch {
      toast.error('Unable to sign in. Please try again.');
    }
  };

  const handleRegister = async (data: RegisterFormData) => {
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      const responseData = await res.json();

      if (!res.ok) {
        toast.error(getRegisterErrorMessage(responseData?.error));
        return;
      }

      setSuccess(true);
      toast.success('Account created successfully!');
      
      // Redirect to welcome page with user details using client-side navigation
      const params = new URLSearchParams({
        email: data.email,
        name: data.name,
      });
      router.push(`/welcome?${params.toString()}`);
    } catch {
      toast.error('Unable to create your account. Please try again.');
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
          <LoginForm onSubmit={handleLogin} />
        ) : (
          <RegisterForm onSubmit={handleRegister} success={success} />
        )}
      </div>
    </AuthCard>
  );
};

AuthSwitch.displayName = 'AuthSwitch';
