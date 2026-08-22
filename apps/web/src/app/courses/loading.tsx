import React from 'react';
import { MainLayout } from '../../components/layout/MainLayout';
import { Container } from '../../components/ui/layout/Container';
import { CourseCardSkeleton } from '../../components/ui/Skeleton';

export default function CoursesLoading() {
  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
        {/* Hero Skeleton */}
        <section className="py-16 sm:py-20 bg-gradient-to-br from-primary-600 to-primary-800">
          <Container>
            <div className="text-center max-w-3xl mx-auto">
              <div className="h-12 w-64 bg-white/20 rounded-lg mx-auto mb-6 animate-pulse" />
              <div className="h-6 w-96 bg-white/10 rounded mx-auto mb-8 animate-pulse" />
              <div className="h-14 bg-white/20 rounded-xl max-w-2xl mx-auto animate-pulse" />
            </div>
          </Container>
        </section>

        {/* Content Skeleton */}
        <section className="py-12">
          <Container>
            {/* Category Filter Skeleton */}
            <div className="flex flex-wrap gap-3 mb-10">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-10 w-24 bg-neutral-200 rounded-lg animate-pulse" />
              ))}
            </div>

            {/* Course Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <CourseCardSkeleton key={i} />
              ))}
            </div>
          </Container>
        </section>
      </div>
    </MainLayout>
  );
}
