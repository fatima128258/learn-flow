'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/layout/Container';

type TopCourse = {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  instructor: {
    id: string;
    name: string | null;
  };
  enrollmentCount: number;
};

function formatEnrollmentCount(value: number) {
  if (value < 1000) return value.toLocaleString();
  if (value < 10000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 2).replace(/\.?0+$/, '')}K`;
  return `${Math.round(value / 1000)}K`;
}

function CourseCard({ course }: { course: TopCourse }) {
  return (
    <article className="flex h-[430px] w-[min(82vw,320px)] shrink-0 flex-col overflow-hidden rounded-[26px] border border-[#ead8c6] bg-[#fffaf5] shadow-sm">
      <div className="h-44 shrink-0 overflow-hidden bg-[#f3e3d2]">
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-[#9a6f54]" aria-hidden="true">📚</div>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-5">
        <h3 className="line-clamp-2 min-h-[3.5rem] text-xl font-semibold leading-7 text-[#2d201b]">
          {course.title}
        </h3>
        <p className="mt-3 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-[#614d45]">
          {course.description || 'Build practical skills with a structured learning experience.'}
        </p>
        <div className="mt-auto border-t border-[#eee0d3] pt-4">
          <p className="truncate text-sm text-[#6a4d40]">
            Instructor: <span className="font-semibold">{course.instructor.name || 'LearnHub Instructor'}</span>
          </p>
          <p className="mt-2 text-sm font-semibold text-[#7a4a2a]">
            {formatEnrollmentCount(course.enrollmentCount)} students
          </p>
          <Link
            href={`/courses/${course.id}`}
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#7a4a2a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#633a22]"
          >
            View course
          </Link>
        </div>
      </div>
    </article>
  );
}

export function TopCourses() {
  const [courses, setCourses] = useState<TopCourse[]>([]);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/courses/top')
      .then((response) => {
        if (!response.ok) throw new Error('TOP_COURSES_UNAVAILABLE');
        return response.json() as Promise<{ data?: TopCourse[] }>;
      })
      .then((body) => {
        if (active) setCourses(Array.isArray(body.data) ? body.data.slice(0, 6) : []);
      })
      .catch(() => {
        if (active) setCourses([]);
      });

    return () => {
      active = false;
    };
  }, []);

  if (courses.length === 0) return null;

  const loopedCourses = [...courses, ...courses];
  return (
    <section id="top6courses" className="overflow-hidden bg-[#f8f2eb] py-14">
      <Container size="xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9a6f54]">Top enrolled courses</span>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[#291d1a] sm:text-4xl">Courses learners choose most</h2>
            <p className="mt-2 text-base text-[#5d463a]">Discover the courses learners are choosing the most.</p>
          </div>
          <Link href="/courses" className="text-sm font-semibold text-[#7a4a2a]">View All Courses <span aria-hidden="true">→</span></Link>
        </div>
        <div className="overflow-hidden">
          <div className="top-courses-track flex w-max gap-5 hover:[animation-play-state:paused]">
            {loopedCourses.map((course, index) => (
              <CourseCard key={`${course.id}-${index}`} course={course} />
            ))}
          </div>
        </div>
      </Container>
      <style jsx>{`
        .top-courses-track {
          animation: top-courses-marquee 35s linear infinite;
        }
        @keyframes top-courses-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(calc(-50% - 0.625rem)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .top-courses-track { animation-play-state: paused; }
        }
      `}</style>
    </section>
  );
}
