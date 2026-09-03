'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  Spinner,
} from '@/components/ui';
import { PageHeader } from '@/components/dashboard';
import { useCurrentUser } from '@/features/auth/useCurrentUser';

type Certificate = {
  certificateId: string;
  verificationToken: string;
  verificationUrl: string;
  courseId: string;
  courseTitle: string;
  organizationId: string;
  organizationName: string;
  instructorName: string;
  studentName: string;
  completionDate: string;
  issuedAt: string;
};

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

export default function StudentCertificatesPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [certificates, setCertificates] = useState<Certificate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadCertificates(orgId: string) {
    try {
      const apiBase = '';
      const res = await fetch(`${apiBase}/api/v1/organizations/${orgId}/student/certificates`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setError('Could not load your certificates. Please try again.');
        return;
      }
      const body = await res.json();
      setCertificates(body.data ?? []);
    } catch {
      setError('Could not reach the server. Please try again.');
    }
  }

  // Check auth and load certificates
  useEffect(() => {
    if (userLoading) return;
    
    if (!user) {
      window.location.href = '/login';
      return;
    }
    
    if (user.role !== 'STUDENT') {
      window.location.href = '/login';
      return;
    }
    
    const orgId = user.organizationId;
    if (!orgId) {
      window.location.href = '/login';
      return;
    }
    
    let active = true;

    async function load() {
      try {
        await loadCertificates(orgId as string);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [user, userLoading]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Certificates" />
        <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <Spinner size="lg" label="Loading certificates..." />
          <span className="text-neutral-700">Loading certificates...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Certificates" />
      {error ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState
              title="Unable to load certificates"
              message={error}
              action={{ label: 'Retry', onClick: () => {
                setError(null);
                setCertificates(null);
                setLoading(true);
                if (user?.organizationId) {
                  loadCertificates(user.organizationId);
                }
              }}}
            />
          </div>
        ) : certificates && certificates.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <EmptyState
              icon={EmptyStateIcons.NoData}
              title="No certificates yet"
              description="Complete your courses to earn certificates. Once a course is completed, you can generate its certificate here."
            />
          </div>
        ) : certificates ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {certificates.map((cert) => (
              <div key={cert.certificateId} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <Badge variant="success" size="sm">Earned</Badge>
                  <span className="text-xs text-neutral-400">{formatDate(cert.issuedAt)}</span>
                </div>
                <h2 className="text-lg font-bold text-neutral-900">{cert.courseTitle}</h2>
                <p className="mt-1 text-sm text-neutral-600">{cert.organizationName}</p>
                <div className="mt-3 space-y-1 text-sm text-neutral-500">
                  <p>Instructor: <span className="text-neutral-700">{cert.instructorName}</span></p>
                  <p>Completed: <span className="text-neutral-700">{formatDate(cert.completionDate)}</span></p>
                </div>
                <div className="mt-4">
                  <Link
                    href={`/dashboard/student/certificates/${cert.certificateId}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                  >
                    View Certificate
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
  );
}
