'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ErrorState, OrganizationPageLoader } from '@/components/ui';
import { PendingPaymentReview } from '@/components/dashboard/PendingPaymentReview';
import { useCurrentUser } from '@/features/auth/useCurrentUser';

export default function OrganizationPaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: user, isLoading: userLoading, isError: userError } = useCurrentUser();
  const organizationId = searchParams.get('organization') || user?.organizationId || '';

  useEffect(() => {
    if (userLoading) return;

    if (!user || userError) {
      router.push('/login');
      return;
    }

    if (user.role !== 'ORG_ADMIN' && user.role !== 'PLATFORM_ADMIN') {
      router.push(
        user.role === 'INSTRUCTOR'
          ? '/dashboard/instructor'
          : user.role === 'STUDENT'
            ? '/dashboard/student'
            : '/dashboard',
      );
    }
  }, [router, user, userError, userLoading]);

  if (userLoading) {
    return <OrganizationPageLoader />;
  }

  if (!user || userError || (user.role !== 'ORG_ADMIN' && user.role !== 'PLATFORM_ADMIN')) {
    return null;
  }

  if (!organizationId) {
    return (
      <div className="mx-auto max-w-6xl">
        <ErrorState
          title="Organization not selected"
          message="Select an organization before viewing its payments."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PendingPaymentReview organizationId={organizationId} />
    </div>
  );
}
