'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { AuthCard } from './AuthCard';
import { LoginForm, LoginFormData } from './LoginForm';
import { RegisterForm, RegisterFormData } from './RegisterForm';
import { getPostLoginRedirect } from '../../features/auth/postLoginRedirect';
import { getLoginErrorMessage, getRegisterErrorMessage } from '../../features/auth/authErrors';
import { meKey } from '../../features/auth/useCurrentUser';
import { useToast } from '../ui/ToastProvider';

export type AuthMode = 'login' | 'register';

export interface AuthSwitchProps {
  initialMode?: AuthMode;
}

const apiBase = '';

export const AuthSwitch: React.FC<AuthSwitchProps> = ({ initialMode = 'login' }) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const switchMode = (next: AuthMode) => {
    if (next === mode) return;
    setSuccess(false);
    setMode(next);
  };

  const handleLogin = async (data: LoginFormData) => {
    try {
      setIsSubmitting(true);
      const res = await fetch(`${apiBase}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      const responseData = await res.json();

      if (!res.ok) {
        toast.error(getLoginErrorMessage(responseData?.error));
        setIsSubmitting(false);
        return;
      }

      toast.success('Signed in successfully. Redirecting...');
      
      // OPTIMIZATION: Invalidate auth cache to ensure fresh /auth/me data after login
      // This populates the React Query cache before navigation, eliminating the need for
      // redundant /auth/me calls when landing on dashboard or other authenticated pages
      await queryClient.invalidateQueries({ queryKey: meKey });
      await queryClient.refetchQueries({ queryKey: meKey });
      
      // Use Next.js client-side navigation instead of full-page reload
      // This preserves React Query cache and eliminates redundant /auth/me calls
      router.push(getPostLoginRedirect(responseData?.user));
    } catch {
      toast.error('Unable to sign in. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (data: RegisterFormData) => {
    try {
      setIsSubmitting(true);
      const res = await fetch(`${apiBase}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      const responseData = await res.json();

      if (!res.ok) {
        toast.error(getRegisterErrorMessage(responseData?.error));
        setIsSubmitting(false);
        return;
      }

      // DO NOT invalidate auth cache or trigger /auth/me after signup.
      // The user should remain on the signup page and see the Welcome screen.
      // Keep the cache empty — no automatic redirect will occur because
      // the useCurrentUser hook will not have fresh data, which is the desired behavior.
      // The user can explicitly navigate after seeing the Welcome message.
      
      setSuccess(true);
      toast.success('Account created successfully!');
    } catch {
      toast.error('Unable to create your account. Please try again.');
      setIsSubmitting(false);
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
