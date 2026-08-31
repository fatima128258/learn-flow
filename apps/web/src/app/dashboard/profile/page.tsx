'use client';

import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { Badge, Button, Card, CardSkeleton, ErrorState } from '@/components/ui';
import { getPostLoginRedirect } from '@/features/auth/postLoginRedirect';
import { PageHeader, UserAvatar } from '@/components/dashboard';

const roleBadgeVariant = (role: string | null | undefined) => {
  if (role === 'PLATFORM_ADMIN') return 'primary' as const;
  if (role === 'ORG_ADMIN') return 'info' as const;
  if (role === 'INSTRUCTOR') return 'warning' as const;
  if (role === 'STUDENT') return 'success' as const;
  return 'default' as const;
};

export default function ProfilePage() {
  const { data: user, isLoading, error } = useCurrentUser();

  if (isLoading) {
    return (
      <div>
        <div className="mx-auto max-w-2xl">
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div>
        <div className="mx-auto max-w-2xl">
          <Card>
            <ErrorState
              title="Unable to load your profile"
              message="Sign in to view your profile."
              action={{ label: 'Go to login', onClick: () => { window.location.href = '/login'; } }}
            />
          </Card>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <div className="mx-auto max-w-2xl">
          <Card>
            <ErrorState
              title="Not signed in"
              message="Sign in to view your profile."
              action={{ label: 'Go to login', onClick: () => { window.location.href = '/login'; } }}
            />
          </Card>
        </div>
      </div>
    );
  }

  const dashboardHref = getPostLoginRedirect(user);

  return (
    <div>
      <div className="mx-auto max-w-2xl">
        <PageHeader
          subtitle="Profile"
          title="Your account"
          actions={
            <Button variant="ghost" onClick={() => { window.location.href = dashboardHref; }}>
              ← Back to dashboard
            </Button>
          }
        />

        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-4 border-b border-neutral-200 p-6">
            <UserAvatar name={user.name} size="lg" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-neutral-900">{user.name ?? '—'}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant={roleBadgeVariant(user.role)} size="sm">
                  {user.role ?? 'UNASSIGNED'}
                </Badge>
                <Badge variant={user.emailVerified ? 'success' : 'warning'} size="sm">
                  {user.emailVerified ? 'Email verified' : 'Email not verified'}
                </Badge>
              </div>
            </div>
          </div>
          <dl className="divide-y divide-neutral-200 px-6">
            <div className="grid gap-1 py-4 sm:grid-cols-3">
              <dt className="text-sm font-medium text-neutral-500">Email</dt>
              <dd className="text-sm text-neutral-900 sm:col-span-2">{user.email}</dd>
            </div>
            <div className="grid gap-1 py-4 sm:grid-cols-3">
              <dt className="text-sm font-medium text-neutral-500">Member since</dt>
              <dd className="text-sm text-neutral-900 sm:col-span-2">
                {new Date(user.createdAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
          <div className="border-t border-neutral-200 px-6 py-4">
            <p className="text-sm text-neutral-500">
              Profile editing is not available yet. Contact your administrator to update your name, email, or password.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}