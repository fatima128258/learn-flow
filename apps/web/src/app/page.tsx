'use client';
import Link from 'next/link';
import { Button } from '../components/ui/Button';
import { LinkButton } from '../components/ui/LinkButton';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Container } from '../components/ui/layout/Container';
import { Stack } from '../components/ui/layout/Stack';
import { MainLayout } from '../components/layout/MainLayout';

export default function Home() {
  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-b from-neutral-50 via-white to-neutral-50">
        {/* Hero Section */}
        <section className="relative py-20 sm:py-32 overflow-hidden">
          {/* Decorative Background */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary-100 rounded-full blur-3xl opacity-20 animate-pulse" />
            <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-primary-200 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
          
          <Container>
            <div className="text-center max-w-4xl mx-auto">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 border border-primary-100 mb-6 animate-fade-in">
                <span className="flex h-2 w-2 rounded-full bg-primary-600 animate-pulse" />
                <span className="text-sm font-medium text-primary-700">Trusted by 10,000+ learners</span>
              </div>
              
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-neutral-900 tracking-tight mb-6 animate-slide-up">
                Transform Learning into{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-primary-800">
                  Growth
                </span>
              </h1>
              
              <p className="text-xl sm:text-2xl text-neutral-600 mb-10 leading-relaxed max-w-3xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
                A comprehensive learning management and digital commerce platform for students, 
                instructors, and organizations to create, share, and monetize knowledge.
              </p>
              
              <Stack direction="horizontal" spacing="md" justify="center" className="flex-wrap animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <LinkButton 
                  href="/register" 
                  variant="primary" 
                  size="lg" 
                  className="shadow-lg shadow-primary-200 hover:shadow-xl hover:shadow-primary-300 transition-shadow"
                  showLoading
                  loadingText="Redirecting..."
                >
                  Start learning today
                </LinkButton>
                <LinkButton 
                  href="/courses" 
                  variant="outline" 
                  size="lg" 
                  className="hover:shadow-md transition-shadow"
                  showLoading
                  loadingText="Loading courses..."
                >
                  Browse courses
                </LinkButton>
              </Stack>
              
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                <div className="text-center">
                  <div className="text-3xl font-bold text-neutral-900">10K+</div>
                  <div className="text-sm text-neutral-600 mt-1">Active Learners</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-neutral-900">500+</div>
                  <div className="text-sm text-neutral-600 mt-1">Expert Instructors</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-neutral-900">1,200+</div>
                  <div className="text-sm text-neutral-600 mt-1">Courses Available</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-neutral-900">98%</div>
                  <div className="text-sm text-neutral-600 mt-1">Satisfaction Rate</div>
                </div>
              </div>
            </div>
          </Container>
        </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <Container>
          <div className="text-center mb-16 animate-fade-in">
            <div className="inline-block px-4 py-2 rounded-full bg-primary-50 border border-primary-100 mb-4">
              <span className="text-sm font-semibold text-primary-700">FEATURES</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 mb-4">
              Everything you need to succeed
            </h2>
            <p className="text-xl text-neutral-600 max-w-2xl mx-auto">
              LearnFlow provides powerful tools for learners, educators, and organizations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card hover className="group transition-all duration-300 border-2 hover:border-primary-200 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <CardHeader>
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                  <svg className="h-7 w-7 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <CardTitle className="mb-3 group-hover:text-primary-600 transition-colors">Rich Course Content</CardTitle>
                <CardDescription className="text-base">
                  Create and deliver engaging courses with videos, quizzes, assignments, and interactive content.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card hover className="group transition-all duration-300 border-2 hover:border-success-200 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <CardHeader>
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-success-50 to-success-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                  <svg className="h-7 w-7 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <CardTitle className="mb-3 group-hover:text-success-600 transition-colors">Progress Tracking</CardTitle>
                <CardDescription className="text-base">
                  Monitor student progress, completion rates, and performance with comprehensive analytics.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card hover className="group transition-all duration-300 border-2 hover:border-warning-200 animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <CardHeader>
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-warning-50 to-warning-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                  <svg className="h-7 w-7 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <CardTitle className="mb-3 group-hover:text-warning-600 transition-colors">Monetization</CardTitle>
                <CardDescription className="text-base">
                  Sell courses, manage subscriptions, and process payments securely with built-in commerce tools.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card hover className="group transition-all duration-300 border-2 hover:border-purple-200 animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <CardHeader>
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                  <svg className="h-7 w-7 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <CardTitle className="mb-3 group-hover:text-purple-600 transition-colors">Multi-Tenant</CardTitle>
                <CardDescription className="text-base">
                  Support multiple organizations with isolated environments, custom branding, and role management.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card hover className="group transition-all duration-300 border-2 hover:border-blue-200 animate-slide-up" style={{ animationDelay: '0.5s' }}>
              <CardHeader>
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                  <svg className="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <CardTitle className="mb-3 group-hover:text-blue-600 transition-colors">Certifications</CardTitle>
                <CardDescription className="text-base">
                  Award certificates upon course completion and track learner achievements and milestones.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card hover className="group transition-all duration-300 border-2 hover:border-error-200 animate-slide-up" style={{ animationDelay: '0.6s' }}>
              <CardHeader>
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-error-50 to-error-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                  <svg className="h-7 w-7 text-error-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <CardTitle className="mb-3 group-hover:text-error-600 transition-colors">Secure & Reliable</CardTitle>
                <CardDescription className="text-base">
                  Enterprise-grade security with data encryption, role-based access, and audit logging.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </Container>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxIDEuNzktNCA0LTRzNCAxLjc5IDQgNHYyYzAgMi4yMS0xLjc5IDQtNCA0cy00LTEuNzktNC00di0yem0wLTMwYzAtMi4yMSAxLjc5LTQgNC00czQgMS43OSA0IDR2MmMwIDIuMjEtMS43OSA0LTQgNHMtNC0xLjc5LTQtNFY0ek02IDM0YzAtMi4yMSAxLjc5LTQgNC00czQgMS43OSA0IDR2MmMwIDIuMjEtMS43OSA0LTQgNHMtNC0xLjc5LTQtNHYtMnptMC0zMGMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0djJjMCAyLjIxLTEuNzkgNC00IDRzLTQtMS43OS00LTRWNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20" />
        
        <Container className="relative">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6 animate-slide-up">
              Ready to transform your learning journey?
            </h2>
            <p className="text-xl text-primary-100 mb-10 leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
              Join thousands of learners and educators building the future of education.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <LinkButton 
                href="/register" 
                variant="secondary" 
                size="lg" 
                className="shadow-xl hover:shadow-2xl transition-shadow bg-white text-primary-700 hover:bg-neutral-50"
                showLoading
                loadingText="Redirecting..."
              >
                Create your free account
              </LinkButton>
              <LinkButton 
                href="/contact" 
                variant="outline" 
                size="lg" 
                className="border-2 border-white text-white hover:bg-white/10"
                showLoading
                loadingText="Loading..."
              >
                Contact sales
              </LinkButton>
            </div>
          </div>
        </Container>
      </section>
      </div>
    </MainLayout>
  );
}
