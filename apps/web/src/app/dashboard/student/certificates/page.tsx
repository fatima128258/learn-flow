'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  Spinner,
} from '@/components/ui';
import { PageHeader } from '@/components/dashboard';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { useMyCourses } from '@/features/student/useMyCourses';

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

// Component to show completed courses that don't have certificates yet
function CompletedCoursesSection({
  courses,
  certificates,
  organizationId,
  generatingCourseId,
  setGeneratingCourseId,
  onCertificateGenerated,
}: {
  courses: Array<{ courseId: string; title: string }>;
  certificates: Certificate[];
  organizationId: string;
  generatingCourseId: string | null;
  setGeneratingCourseId: (id: string | null) => void;
  onCertificateGenerated: () => void;
}) {
  const [completedCourses, setCompletedCourses] = useState<Array<{ courseId: string; title: string; percentage: number }>>([]);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Fetch progress for each course to check completion
  useEffect(() => {
    if (!organizationId || courses.length === 0) return;

    const fetchProgress = async () => {
      setLoadingProgress(true);
      const completed: Array<{ courseId: string; title: string; percentage: number }> = [];
      
      for (const course of courses) {
        try {
          const res = await fetch(
            `/api/v1/organizations/${organizationId}/student/courses/${course.courseId}/progress`,
            { credentials: 'include' }
          );
          if (res.ok) {
            const data = await res.json();
            const progress = data.data;
            if (progress?.coursePercentage === 100) {
              // Check if certificate already exists
              const hasCertificate = certificates.some(cert => cert.courseId === course.courseId);
              if (!hasCertificate) {
                completed.push({
                  courseId: course.courseId,
                  title: course.title,
                  percentage: progress.coursePercentage,
                });
              }
            }
          }
        } catch (err) {
          console.error(`Error fetching progress for course ${course.courseId}:`, err);
        }
      }
      
      setCompletedCourses(completed);
      setLoadingProgress(false);
    };

    fetchProgress();
  }, [courses, certificates, organizationId]);

  const handleGenerateCertificate = async (courseId: string) => {
    setGeneratingCourseId(courseId);
    
    try {
      // Make direct API call instead of using hook
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/student/courses/${courseId}/certificate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        }
      );
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (errorData.error === 'CERTIFICATE_EXISTS') {
          // Certificate already exists, just refresh
          setCompletedCourses(prev => prev.filter(c => c.courseId !== courseId));
          onCertificateGenerated();
          return;
        }
        throw new Error(errorData.error || 'Failed to generate certificate');
      }
      
      // Success - remove from completed list and refresh certificates
      setCompletedCourses(prev => prev.filter(c => c.courseId !== courseId));
      onCertificateGenerated();
    } catch (error) {
      console.error('Failed to generate certificate:', error);
      // Show error to user
      alert(error instanceof Error ? error.message : 'Failed to generate certificate. Please try again.');
    } finally {
      setGeneratingCourseId(null);
    }
  };

  if (loadingProgress || completedCourses.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="mb-4 text-lg font-semibold text-neutral-900">Completed Courses</h2>
      <div className="space-y-3">
        {completedCourses.map((course) => (
          <div
            key={course.courseId}
            className="rounded-2xl border border-success-200 bg-success-50 p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="success" size="sm">100% Complete</Badge>
                  <h3 className="text-lg font-semibold text-neutral-900">{course.title}</h3>
                </div>
                <p className="text-sm text-success-700">
                  🎉 Congratulations! You've completed this course. Generate your certificate now.
                </p>
              </div>
              <Button
                size="md"
                variant="primary"
                disabled={generatingCourseId === course.courseId}
                onClick={() => handleGenerateCertificate(course.courseId)}
                title="Generate your certificate for completing this course"
              >
                {generatingCourseId === course.courseId ? 'Generating...' : 'Generate Certificate'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StudentCertificatesPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [certificates, setCertificates] = useState<Certificate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [generatingCourseId, setGeneratingCourseId] = useState<string | null>(null);

  // Fetch enrolled courses to check for completed ones
  const { data: courses = [] } = useMyCourses(organizationId || '');

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
    
    setOrganizationId(orgId);
    
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
        ) : (
          <>
            {/* Completed Courses Section - for generating certificates */}
            <CompletedCoursesSection 
              courses={courses}
              certificates={certificates || []}
              organizationId={organizationId || ''}
              generatingCourseId={generatingCourseId}
              setGeneratingCourseId={setGeneratingCourseId}
              onCertificateGenerated={() => {
                if (organizationId) {
                  loadCertificates(organizationId);
                }
              }}
            />

            {/* Existing Certificates Section */}
            {certificates && certificates.length === 0 ? (
              <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <EmptyState
                  icon={EmptyStateIcons.NoData}
                  title="No certificates yet"
                  description="Complete your courses to earn certificates. Once a course is completed, you can generate its certificate here."
                />
              </div>
            ) : certificates && certificates.length > 0 ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-neutral-900">Your Certificates</h2>
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
              </>
            ) : null}
          </>
        )}
      </div>
  );
}
