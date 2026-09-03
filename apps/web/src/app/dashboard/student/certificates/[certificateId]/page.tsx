'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
  pdfUrl?: string | null;
  pdfDownloadUrl?: string | null;
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

export default function StudentCertificateViewPage() {
  const params = useParams();
  const certificateId = typeof params.certificateId === 'string' ? params.certificateId : null;
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);

  async function loadCertificate(orgId: string, certId: string, retryCount = 0) {
    try {
      const apiBase = '';
      const res = await fetch(`${apiBase}/api/v1/organizations/${orgId}/student/certificates/${certId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        let code: unknown = null;
        try {
          code = (await res.json())?.error;
        } catch {
          code = null;
        }
        setError(code === 'CERTIFICATE_NOT_FOUND' ? 'Certificate not found.' : 'Could not load this certificate.');
        return;
      }
      const body = await res.json();
      const cert = body.data ?? null;
      setCertificate(cert);
      
      // If PDF is still being generated (newly created certificate), retry after a delay
      if (cert && !cert.pdfUrl && retryCount < 5) {
        setError(null); // Clear any previous error
        setRetrying(true);
        const delay = Math.min(1000 + retryCount * 500, 3000); // Start at 1s, increase each retry up to 3s
        setTimeout(() => {
          loadCertificate(orgId, certId, retryCount + 1);
        }, delay);
      } else if (cert && !cert.pdfUrl && retryCount >= 5) {
        // After 5 retries, still no PDF - show it anyway, PDF might still be generating
        setError(null);
        setRetrying(false);
      } else {
        // PDF is available
        setRetrying(false);
      }
    } catch {
      setError('Could not reach the server. Please try again.');
      setRetrying(false);
    }
  }

  // Check auth and load certificate
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
    
    if (!certificateId) {
      setLoading(false);
      return;
    }
    
    let active = true;

    async function load() {
      try {
        await loadCertificate(orgId as string, certificateId as string);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [user, userLoading, certificateId]);

  async function copyUrl() {
    if (!certificate) return;
    try {
      await navigator.clipboard.writeText(certificate.verificationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader subtitle="Student" title="View Certificate" />
        <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <Spinner size="lg" label={retrying ? "Generating certificate..." : "Loading certificate..."} />
          <span className="text-neutral-700">{retrying ? "Generating certificate..." : "Loading certificate..."}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        subtitle="Student"
        title="View Certificate"
          breadcrumbs={
            <div className="flex items-center gap-2 text-sm">
              <Link href="/dashboard/student" className="text-primary-600 hover:text-primary-700">My Courses</Link>
              <span className="text-neutral-400">/</span>
              <Link href="/dashboard/student/certificates" className="text-primary-600 hover:text-primary-700">Certificates</Link>
              <span className="text-neutral-400">/</span>
              <span className="text-neutral-600">View</span>
            </div>
          }
        />

        {error ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState title="Unable to load certificate" message={error} />
          </div>
        ) : certificate ? (
          <div className="overflow-hidden rounded-2xl border-2 border-primary-200 bg-white shadow-sm">
            <div className="border-b border-primary-100 bg-primary-50 px-8 py-5 text-center">
              <p className="text-sm font-medium uppercase tracking-widest text-primary-600">Certificate of Completion</p>
              <h1 className="mt-2 text-3xl font-bold text-neutral-900">{certificate.courseTitle}</h1>
            </div>

            <div className="px-8 py-8 text-center">
              <p className="text-sm text-neutral-500">This certifies that</p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">{certificate.studentName}</p>
              <p className="mt-1 text-sm text-neutral-500">
                has successfully completed the course
              </p>
              <p className="mt-2 text-lg font-semibold text-primary-700">{certificate.courseTitle}</p>
              <p className="mt-1 text-sm text-neutral-500">
                offered by <span className="text-neutral-700">{certificate.organizationName}</span>
                {' '}· instructed by <span className="text-neutral-700">{certificate.instructorName}</span>
              </p>

              <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-3">
                <div className="text-sm text-neutral-600">
                  <p>Completed on</p>
                  <p className="font-semibold text-neutral-900">{formatDate(certificate.completionDate)}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-100 px-8 py-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-400">Certificate ID</p>
                  <p className="font-mono text-sm text-neutral-900">{certificate.certificateId}</p>
                </div>
                <Badge variant="success" size="sm">Verified</Badge>
              </div>

              <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-xs uppercase tracking-wide text-neutral-400">Verification URL</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <code className="truncate text-xs text-neutral-700">{certificate.verificationUrl}</code>
                  <button
                    type="button"
                    onClick={copyUrl}
                    className="shrink-0 rounded-md bg-primary-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-primary-700"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {certificate.pdfUrl && certificate.pdfDownloadUrl ? (
                  <a
                    href={certificate.pdfDownloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border-2 border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
                  >
                    Download PDF
                  </a>
                ) : null}
                <a
                  href={certificate.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                >
                  Verify Publicly
                </a>
                <Link
                  href={`/dashboard/student/courses/${certificate.courseId}`}
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-primary-600 px-4 py-2 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
                >
                  Back to Course
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <EmptyState icon={EmptyStateIcons.NoData} title="Certificate not found" />
          </div>
        )}
      </div>
  );
}
