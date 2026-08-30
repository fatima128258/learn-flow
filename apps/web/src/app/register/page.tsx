'use client';
import React from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthSwitch } from '../../components/auth/AuthSwitch';

export default function RegisterPage() {
  return (
    <AuthLayout hideChrome>
      <AuthSwitch initialMode="register" />
    </AuthLayout>
  );
}