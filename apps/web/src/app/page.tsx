import { MainLayout } from '../components/layout/MainLayout';
import { Container } from '../components/ui/layout/Container';
import { Stack } from '../components/ui/layout/Stack';
import { LinkButton } from '../components/ui/LinkButton';
import { Badge } from '../components/ui/Badge';
import { FeatureCard } from '../components/public/FeatureCard';
import { Section, SectionHeading } from '../components/public/Section';
import { Reveal } from '../components/public/Reveal';
import { Accordion } from '../components/public/Accordion';
import { faqItems } from '../lib/faqItems';
import Link from 'next/link';

const capabilities = [
  {
    icon: <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
    title: 'Structured courses',
    description: 'Content is organized into modules and lessons so each course builds logically, step by step.',
  },
  {
    icon: <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    title: 'Progress tracking',
    description: 'See completion, scores, and streaks across every course in a clear personal dashboard.',
  },
  {
    icon: <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    title: 'Quizzes & assessments',
    description: 'Reinforce lessons with quizzes tied to topics, and revisit the areas you miss.',
  },
  {
    icon: <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
    title: 'Certificates',
    description: 'Earn a certificate when you finish a course to recognize your achievement.',
  },
  {
    icon: <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    title: 'Instructor tools',
    description: 'Create and organize courses, then follow how your learners are progressing.',
  },
  {
    icon: <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    title: 'Organization workspaces',
    description: 'Manage learning programs, learners, and instructors in isolated environments.',
  },
  {
    icon: <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
    title: 'Smart notifications',
    description: 'Stay on track with timely in-app and email updates about your courses and progress.',
  },
  {
    icon: <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
    title: 'Secure accounts',
    description: 'Role-based access and secure sessions keep your learning data protected by default.',
  },
];

const whyChooseUs = [
  {
    icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    title: 'Secure by default',
    description: 'Strong password hashing, email verification, and strict rate limiting keep accounts and data protected.',
  },
  {
    icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    title: 'Built for every role',
    description: 'Dedicated dashboards for learners, instructors, and organizations — each focused on what matters to them.',
  },
  {
    icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    title: 'Fast and responsive',
    description: 'A modern stack with efficient search and a snappy interface, so learning never feels slow.',
  },
];

export default function Home() {
  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section id="home" className="relative overflow-hidden">
          <Container size="xl" className="py-24 sm:py-28 lg:py-36">
            <div className="grid items-center gap-12 md:grid-cols-12 md:gap-16 lg:gap-20">
              <div className="text-center md:col-span-5 md:text-left">
                <div className="animate-slide-up">
                  <Badge variant="primary" className="mb-6 px-3 py-1">
                    The learning platform for focused study
                  </Badge>
                </div>

                <h1 className="text-3xl font-bold text-neutral-900 tracking-tight sm:text-4xl lg:text-5xl animate-slide-up">
                  Courses, progress, and goals —{' '}
                  <span className="text-primary-600">finally in one place.</span>
                </h1>

                <p className="mx-auto mt-6 max-w-xl text-lg sm:text-lg leading-relaxed text-neutral-600 lg:mx-0 animate-slide-up" style={{ animationDelay: '0.05s' }}>
                  LearnFlow keeps lessons, quizzes, and certificates organized so you can
                  spend less time managing and more time actually learning.
                </p>

                <Stack direction="horizontal" spacing="sm" justify="center" className="mt-8 flex-wrap gap-3 md:justify-start md:gap-4 animate-slide-up w-full md:w-auto" style={{ animationDelay: '0.1s' }}>
                  <LinkButton
                    href="/register"
                    variant="primary"
                    size="md"
                    className="!font-normal shadow-sm shadow-primary-200 w-full md:w-auto"
                    showLoading
                    loadingText="Redirecting..."
                  >
                    Create free account
                  </LinkButton>
                  <Link
                    href="/#features"
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-neutral-300 px-5 text-sm font-normal text-neutral-700 transition-colors hover:bg-neutral-50 hover:border-neutral-400 w-full md:w-auto"
                  >
                    See how it works
                  </Link>
                </Stack>
              </div>

              {/* Product image */}
              <div className="relative animate-fade-in hidden md:col-span-7 md:block">
                <img
                  src="/pik.png"
                  alt="LearnFlow learning platform"
                  className="w-full h-auto rounded-2xl border border-neutral-200 shadow-xl shadow-neutral-200/60"
                />
              </div>
            </div>
          </Container>
        </section>

        {/* Features */}
        <Section id="features" background="muted">
          <Reveal>
            <SectionHeading
              eyebrow="PLATFORM FEATURES"
              title="One platform for the entire learning journey"
              description="LearnFlow brings courses, progress, and proof of completion together — so learners, instructors, and organizations stay aligned without juggling separate tools."
            />
          </Reveal>
          <Reveal className="features-marquee relative" y={20}>
            <div className="features-marquee__track flex w-max py-6">
              {capabilities.map((capability, i) => (
                <FeatureCard
                  key={capability.title}
                  {...capability}
                  className="w-[280px] shrink-0 mr-6 sm:w-[300px] lg:w-[320px]"
                />
              ))}
              {/* Duplicated sequence for a seamless infinite loop (hidden from AT) */}
              {capabilities.map((capability, i) => (
                <FeatureCard
                  key={`dup-${capability.title}`}
                  {...capability}
                  className="w-[280px] shrink-0 mr-6 sm:w-[300px] lg:w-[320px]"
                  ariaHidden
                />
              ))}
            </div>
          </Reveal>
        </Section>

        {/* Why Choose Us */}
        <Section id="why-choose-us" background="white">
          <Reveal>
            <SectionHeading
              eyebrow="WHY CHOOSE US"
              title="Purpose-built for learning, not just 'an LMS'"
              description="LearnFlow brings together everything that makes online learning stick — clear structure, steady progress, and real proof of completion."
              descriptionClassName="mx-auto mt-6 max-w-xl text-lg sm:text-lg leading-relaxed text-neutral-600 lg:mx-0 animate-slide-up"
              descriptionStyle={{ animationDelay: '0.05s' }}
            />
          </Reveal>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {whyChooseUs.map((item, i) => (
              <Reveal key={item.title} delay={i * 70}>
                <div className="flex h-full flex-col rounded-xl border border-neutral-200 bg-background-alt p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-600 text-white mb-4">
                    {item.icon}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-neutral-900">{item.title}</h3>
                  <p className="text-neutral-600 leading-relaxed">{item.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* FAQ */}
        <Section id="faq" background="muted">
          <Reveal>
            <SectionHeading
              eyebrow="FAQ"
              title="Frequently asked questions"
              description="Quick answers about learning, teaching, and managing with LearnFlow."
              descriptionClassName="mx-auto mt-6 max-w-xl text-lg sm:text-lg leading-relaxed text-neutral-600 lg:mx-0 animate-slide-up"
              descriptionStyle={{ animationDelay: '0.05s' }}
            />
          </Reveal>
          <div className="mx-auto max-w-3xl">
            <Accordion items={faqItems} />
          </div>
        </Section>
      </div>
    </MainLayout>
  );
}
