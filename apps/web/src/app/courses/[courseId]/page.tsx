'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { useCourseOverview } from '@/features/student/useCourseStore';
import { currency, type CourseOverview } from '@/lib/types';
import { Badge, Button, Card, CardSkeleton, EmptyState, ErrorState, LinkButton, Skeleton } from '@/components/ui';

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-center">
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
    </div>
  );
}

function OverviewBody({ course, checkoutHref }: { course: CourseOverview; checkoutHref: string }) {
  const hasDiscount = course.discountPrice !== null && course.discountPrice < course.price;
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 p-6 sm:p-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {course.category && <Badge variant="primary" size="sm">{course.category.name}</Badge>}
          <Badge variant="success" size="sm">{course.status}</Badge>
        </div>
        <h1 className="text-3xl font-bold text-neutral-900">{course.title}</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Instructor:{' '}
          <span className="font-medium text-neutral-700">
            {course.instructor.name ?? course.instructor.email}
          </span>
        </p>
      </div>

      <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
        <StatBlock label="Modules" value={course.moduleCount} />
        <StatBlock label="Lessons" value={course.lessonCount} />
        <StatBlock label="Quizzes" value={course.quizCount} />
      </div>

      {course.description ? (
        <div className="px-6 pb-8 sm:px-8">
          <h2 className="mb-2 text-lg font-semibold text-neutral-900">About this course</h2>
          <p className="whitespace-pre-line text-neutral-700">{course.description}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 border-t border-neutral-200 bg-neutral-50 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-neutral-900">{currency(course.price)}</span>
          {hasDiscount && (
            <span className="text-sm font-medium text-neutral-400 line-through">
              {currency(course.discountPrice ?? course.price)}
            </span>
          )}
        </div>
        {course.isEnrolled ? (
          <LinkButton href={`/dashboard/student/courses/${course.id}`} size="lg">
            Continue Learning
          </LinkButton>
        ) : (
          <LinkButton href={checkoutHref} size="lg">
            Enroll Now
          </LinkButton>
        )}
      </div>
    </div>
  );
}

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;

  const { data: user, isLoading: userLoading } = useCurrentUser();

  const organizationId = user?.organizationId ?? '';
  const { data: course, isLoading: courseLoading } = useCourseOverview(organizationId, courseId);

  if (userLoading) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <CardSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <EmptyState
              icon={
                <svg className="h-16 w-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a4 4 0 00-4-4m-3 .364A3.5 3.5 0 1117.5 20H15z" />
                </svg>
              }
              title="Log in to view this course"
              description="You need to be signed in as a student to view course details and purchase."
              action={{ label: 'Log in', onClick: () => { window.location.href = '/login'; } }}
            />
          </Card>
        </div>
      </main>
    );
  }

  if (user.role !== 'STUDENT') {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <EmptyState
              icon={
                <svg className="h-16 w-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title="This area is for students"
              description="Course purchases are available to student accounts. If you are an instructor, manage your courses from your dashboard."
              action={{ label: 'Go to my dashboard', onClick: () => { window.location.href = '/dashboard'; } }}
            />
          </Card>
        </div>
      </main>
    );
  }

  if (!organizationId) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <EmptyState
              title="No organization yet"
              description="Join an organization to browse and purchase courses. Ask your organization administrator to add you."
            />
          </Card>
        </div>
      </main>
    );
  }

  const checkoutHref = `/checkout/${courseId}`;

  if (courseLoading) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-3">
            <Skeleton variant="text" height={24} width={200} className="mb-2" />
            <Skeleton variant="rectangular" height={240} />
          </div>
        </div>
      </main>
    );
  }

  if (!course) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <ErrorState
              title="Course not available"
              message="This course was not found or is not published yet."
            />
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-4xl">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/dashboard/student/search" className="text-primary-600 hover:text-primary-700">
                Course Catalog
              </Link>
            </li>
            <li aria-hidden="true" className="text-neutral-400">/</li>
            <li className="text-neutral-600">{course.title}</li>
          </ol>
        </nav>
        <OverviewBody course={course} checkoutHref={checkoutHref} />
      </div>
    </main>
  );
}