'use client';
import React from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthSwitch } from '../../components/auth/AuthSwitch';

export default function LoginPage() {
  return (
    <AuthLayout hideChrome>
      <AuthSwitch initialMode="login" />
    </AuthLayout>
  );
}