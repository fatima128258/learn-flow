'use client';
import React, { useState } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthCard } from '../../components/auth/AuthCard';
import { RegisterForm, RegisterFormData } from '../../components/auth/RegisterForm';

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (data: RegisterFormData) => {
    setError(null);
    
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
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
      
      // Success
      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      throw err;
    }
  };

  return (
    <AuthLayout>
      <AuthCard
        title="Create your account"
        description="Start learning, teaching, and growing with LearnFlow."
        footer={{
          text: 'Already have an account?',
          linkText: 'Sign in',
          linkHref: '/login'
        }}
      >
        <RegisterForm onSubmit={handleRegister} error={error} success={success} />
      </AuthCard>
    </AuthLayout>
  );
}
