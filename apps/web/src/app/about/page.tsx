import React from 'react';
import Link from 'next/link';
import { MainLayout } from '../../components/layout/MainLayout';
import { Container } from '../../components/ui/layout/Container';
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { LinkButton } from '../../components/ui/LinkButton';

export default function AboutPage() {
  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
        {/* Hero Section */}
        <section className="relative py-20 sm:py-28 bg-gradient-to-br from-primary-600 to-primary-800 overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0YzAtMi4yMSAxLjc5LTQgNC00czQgMS43OSA0IDR2MmMwIDIuMjEtMS43OSA0LTQgNHMtNC0xLjc5LTQtNHYtMnptMC0zMGMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0djJjMCAyLjIxLTEuNzkgNC00IDRzLTQtMS43OS00LTRWNHpNNiAzNGMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0djJjMCAyLjIxLTEuNzkgNC00IDRzLTQtMS43OS00LTR2LTJ6bTAtMzBjMC0yLjIxIDEuNzktNCA0LTRzNCAxLjc5IDQgNHYyYzAgMi4yMS0xLjc5IDQtNCA0cy00LTEuNzktNC00VjR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
          
          <Container className="relative">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight animate-slide-up">
                About LearnFlow
              </h1>
              <p className="text-xl text-primary-100 leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
                We&apos;re on a mission to make quality education accessible to everyone, everywhere.
              </p>
            </div>
          </Container>
        </section>

        {/* Mission Section */}
        <section className="py-20">
          <Container>
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-4xl font-bold text-neutral-900 mb-6">Our Mission</h2>
              <p className="text-lg text-neutral-600 leading-relaxed">
                At LearnFlow, we believe that education is the foundation of personal and professional growth. 
                Our platform connects passionate instructors with eager learners, creating a thriving community 
                where knowledge is shared, skills are developed, and futures are transformed.
              </p>
            </div>

            {/* Values Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="text-center border-2 hover:border-primary-200 transition-all animate-slide-up">
                <CardHeader>
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center mb-4">
                    <svg className="h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <CardTitle className="mb-3">Quality Content</CardTitle>
                  <CardDescription>
                    Expert-curated courses designed to deliver real-world skills and knowledge
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="text-center border-2 hover:border-success-200 transition-all animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <CardHeader>
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-success-50 to-success-100 flex items-center justify-center mb-4">
                    <svg className="h-8 w-8 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <CardTitle className="mb-3">Community First</CardTitle>
                  <CardDescription>
                    A supportive environment where learners and instructors grow together
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="text-center border-2 hover:border-warning-200 transition-all animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <CardHeader>
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-warning-50 to-warning-100 flex items-center justify-center mb-4">
                    <svg className="h-8 w-8 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <CardTitle className="mb-3">Innovation</CardTitle>
                  <CardDescription>
                    Leveraging the latest technology to enhance the learning experience
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </Container>
        </section>

        {/* Stats Section */}
        <section className="py-20 bg-neutral-50">
          <Container>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div className="animate-fade-in">
                <div className="text-5xl font-bold text-primary-600 mb-2">10K+</div>
                <div className="text-neutral-600 font-medium">Active Learners</div>
              </div>
              <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <div className="text-5xl font-bold text-success-600 mb-2">500+</div>
                <div className="text-neutral-600 font-medium">Expert Instructors</div>
              </div>
              <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <div className="text-5xl font-bold text-warning-600 mb-2">1,200+</div>
                <div className="text-neutral-600 font-medium">Courses</div>
              </div>
              <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
                <div className="text-5xl font-bold text-purple-600 mb-2">98%</div>
                <div className="text-neutral-600 font-medium">Satisfaction</div>
              </div>
            </div>
          </Container>
        </section>

        {/* Team Section */}
        <section className="py-20">
          <Container>
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-neutral-900 mb-4">Meet Our Team</h2>
              <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
                Dedicated professionals working together to transform education
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { name: 'Sarah Johnson', role: 'CEO & Founder', initials: 'SJ' },
                { name: 'Michael Chen', role: 'CTO', initials: 'MC' },
                { name: 'Emma Williams', role: 'Head of Design', initials: 'EW' },
                { name: 'David Martinez', role: 'Head of Education', initials: 'DM' },
              ].map((member, index) => (
                <Card key={member.name} className="text-center border-2 hover:border-primary-200 transition-all animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                  <CardHeader>
                    <div className="mx-auto h-24 w-24 rounded-full bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center mb-4 shadow-lg">
                      <span className="text-2xl font-bold text-white">{member.initials}</span>
                    </div>
                    <CardTitle className="text-lg mb-1">{member.name}</CardTitle>
                    <CardDescription>{member.role}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </Container>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-br from-primary-600 to-primary-800">
          <Container>
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-4xl font-bold text-white mb-6">Join Our Community</h2>
              <p className="text-xl text-primary-100 mb-8">
                Start learning today and become part of our growing community
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <LinkButton 
                  href="/register" 
                  variant="secondary" 
                  size="lg" 
                  className="bg-white text-primary-700 hover:bg-neutral-50 shadow-xl"
                  showLoading
                  loadingText="Redirecting..."
                >
                  Get started for free
                </LinkButton>
                <LinkButton 
                  href="/courses" 
                  variant="outline" 
                  size="lg" 
                  className="border-2 border-white text-white hover:bg-white/10"
                  showLoading
                  loadingText="Loading courses..."
                >
                  Explore courses
                </LinkButton>
              </div>
            </div>
          </Container>
        </section>
      </div>
    </MainLayout>
  );
}
