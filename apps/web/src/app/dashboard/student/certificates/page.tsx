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
    console.log('[FRONTEND-CERT] === Certificate Generation Started ===');
    console.log('[FRONTEND-CERT] Button clicked for course:', courseId);
    console.log('[FRONTEND-CERT] organizationId:', organizationId || 'NOT SET');
    
    // **FIX: Check if organizationId is available**
    if (!organizationId) {
      console.error('[FRONTEND-CERT] ✗ organizationId is not available yet!');
      alert('Organization ID not loaded. Please wait a moment and try again.');
      return;
    }
    
    setGeneratingCourseId(courseId);
    
    try {
      const apiUrl = `/api/v1/organizations/${organizationId}/student/courses/${courseId}/certificate`;
      console.log('[FRONTEND-CERT] Making POST request to:', apiUrl);
      console.log('[FRONTEND-CERT] Request time:', new Date().toISOString());
      
      // Make direct API call instead of using hook
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      
      console.log('[FRONTEND-CERT] Response status:', res.status, res.statusText);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('[FRONTEND-CERT] ✗ API Error:', errorData);
        
        // Handle specific error cases
        if (errorData.error === 'CERTIFICATE_EXISTS') {
          console.log('[FRONTEND-CERT] Certificate already exists, refreshing list...');
          // Certificate already exists, just refresh
          setCompletedCourses(prev => prev.filter(c => c.courseId !== courseId));
          onCertificateGenerated();
          return;
        }
        
        // Map error codes to user-friendly messages
        const errorMessages: Record<string, string> = {
          'COURSE_NOT_COMPLETED': 'Course is not yet completed. Please finish all lessons first.',
          'STUDENT_NOT_ENROLLED': 'You are not enrolled in this course.',
          'COURSE_NOT_FOUND': 'Course not found.',
          'FORBIDDEN': 'You do not have permission to generate this certificate.',
          'SERVER_ERROR': 'Server error. Please try again later.',
        };
        
        const message = errorMessages[errorData.error] || `Failed to generate certificate: ${errorData.error || 'Unknown error'}`;
        throw new Error(message);
      }
      
      const responseData = await res.json();
      console.log('[FRONTEND-CERT] ✓ Certificate generated successfully:', responseData);
      
      // Success - remove from completed list and refresh certificates
      setCompletedCourses(prev => prev.filter(c => c.courseId !== courseId));
      onCertificateGenerated();
      console.log('[FRONTEND-CERT] === Certificate Generation Completed ===');
    } catch (error) {
      console.error('[FRONTEND-CERT] === Certificate Generation Failed ===');
      console.error('[FRONTEND-CERT] Error:', error);
      
      // Show error to user with better messages
      let errorMessage = 'Failed to generate certificate. Please try again.';
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Cannot connect to server. Please make sure the API server is running.';
        console.error('[FRONTEND-CERT] Network error - API server may be down');
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setGeneratingCourseId(null);
      console.log('[FRONTEND-CERT] Button state reset');
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
