'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Certificate = {
  certificateId: string;
  verificationUrl: string;
  courseTitle: string;
  organizationName: string;
  instructorName: string;
  studentName: string;
  completionDate: string;
  issuedAt: string;
  pdfUrl?: string | null;
};

export default function PublicCertificateVerificationPage({
  params,
}: {
  params: Promise<{ verificationToken: string }>;
}) {
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCertificate() {
      const { verificationToken } = await params;
      const response = await fetch(`/api/v1/certificates/verify/${verificationToken}`);
      const body = await response.json();

      if (!response.ok || !body.success || !body.data) {
        if (active) setError('Certificate not found.');
        return;
      }

      if (active) setCertificate(body.data);
    }

    loadCertificate().catch(() => {
      if (active) setError('Could not verify this certificate.');
    });

    return () => {
      active = false;
    };
  }, [params]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-neutral-900">Certificate not found</h1>
          <p className="mt-3 text-neutral-600">{error}</p>
        </div>
      </main>
    );
  }

  if (!certificate) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-center text-neutral-600">Verifying certificate...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="overflow-hidden rounded-2xl border-2 border-primary-200 bg-white shadow-sm">
        <div className="border-b border-primary-100 bg-primary-50 px-8 py-6 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-primary-600">
            Certificate Verification
          </p>
          <h1 className="mt-2 text-3xl font-bold text-neutral-900">{certificate.courseTitle}</h1>
          <p className="mt-2 font-semibold text-success-700">Certificate is valid</p>
        </div>

        <div className="grid gap-5 px-8 py-8 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-400">Certificate ID</p>
            <p className="mt-1 font-mono text-sm text-neutral-900">{certificate.certificateId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-400">Student</p>
            <p className="mt-1 text-neutral-900">{certificate.studentName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-400">Organization</p>
            <p className="mt-1 text-neutral-900">{certificate.organizationName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-400">Instructor</p>
            <p className="mt-1 text-neutral-900">{certificate.instructorName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-400">Completed</p>
            <p className="mt-1 text-neutral-900">
              {new Date(certificate.completionDate).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-400">Issued</p>
            <p className="mt-1 text-neutral-900">
              {new Date(certificate.issuedAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="border-t border-neutral-100 px-8 py-5 text-center">
          <Link
            href="/"
            className="inline-flex rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            LearnFlow home
          </Link>
        </div>
      </div>
    </main>
  );
}
