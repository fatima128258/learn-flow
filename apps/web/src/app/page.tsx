import Link from 'next/link';
import { MainLayout } from '../components/layout/MainLayout';
import { Container } from '../components/ui/layout/Container';
import { LinkButton } from '../components/ui/LinkButton';
import { Accordion } from '../components/public/Accordion';
import { AnimatedCounter } from '../components/public/AnimatedCounter';
import { Reveal } from '../components/public/Reveal';

const stats = [
  { label: '100+', value: 'Expert Instructors' },
  { label: '5000+', value: 'Courses' },
  { label: '50K+', value: 'Students' },
  { label: '4.8/5', value: 'Average Rating' },
];

const highlights = [
  { icon: '🎓', title: 'Expert Instructors', text: 'Learn from industry-ready educators and leaders.' },
  { icon: '⏱️', title: 'Flexible Learning', text: 'Study at your pace, from anywhere, anytime.' },
  { icon: '🏆', title: 'Certificates', text: 'Show proof of learning with verified completion badges.' },
  { icon: '📱', title: 'Access on Any Device', text: 'Learn seamlessly on desktop, tablet, or mobile.' },
  { icon: '🤝', title: 'Dedicated Support', text: 'Get help whenever you need guidance or encouragement.' },
];

const faqItems = [
  { id: 'what-is-learnhub', question: 'What is LearnHub?', answer: 'LearnHub is a focused learning platform for structured study, project practice, and skill-building. It brings guided courses, progress tracking, quizzes, and certificates together in one calm learning workspace.' },
  { id: 'get-started', question: 'How do I get started?', answer: 'Create your account, explore your chosen track, and enroll in the course that matches your goals. You can begin with a beginner-friendly course and build your learning path at your own pace.' },
  { id: 'progress-tracking', question: 'How does progress tracking work?', answer: 'Every completed lesson and quiz updates your learning progress so you can stay on top of your journey. Your dashboard helps you see what you have finished and what to focus on next.' },
  { id: 'certificates', question: 'Do you offer certificates?', answer: 'Yes. You can earn a certificate when you complete a course successfully, giving you a clear record of the skills and learning milestones you have achieved.' },
  { id: 'any-device', question: 'Can I learn on any device?', answer: 'Absolutely. LearnHub is built to work smoothly across desktop, laptop, tablet, and mobile devices, so you can continue learning wherever your schedule takes you.' },
  { id: 'course-support', question: 'What kind of support is available?', answer: 'You can learn through structured lessons, guided course content, and clear progress updates. Our platform is designed to keep your next step easy to find whenever you need direction.' },
  { id: 'learning-pace', question: 'Can I learn at my own pace?', answer: 'Yes. LearnHub gives you the flexibility to study when it works for you, revisit lessons when needed, and make steady progress without having to follow a fixed schedule.' },
];

export default function Home() {
  return (
    <MainLayout>
      <div className="min-h-screen bg-[#f8f2eb] text-[#2d201b]">
        <section id="home" className="relative overflow-hidden bg-[#f7efe8]">
          <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,_rgba(233,194,147,0.22),_transparent_55%)]" />
          <Container size="xl" className="relative pb-10 pt-24 sm:pb-12 sm:pt-28 lg:pb-14 lg:pt-28">
            <div className="grid items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="max-w-[620px]">
                <Reveal y={10} className="w-fit">
                  <span className="inline-flex items-center rounded-full border border-[#ead6c0] bg-[#f3e3d2] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7a4a2a] shadow-sm">
                  Your Learning Journey Starts Here
                  </span>
                </Reveal>

                <Reveal delay={100} y={18}>
                  <h1 className="mt-6 text-4xl font-bold leading-[1.04] tracking-[-0.04em] text-[#231915] sm:text-5xl lg:text-[4.1rem]">
                  Learn Today,
                  <br />
                  Build a Bright <span className="text-[#d8843e]">Future</span>
                  </h1>
                </Reveal>

                <Reveal delay={200} y={16}>
                  <p className="mt-5 max-w-xl text-base leading-8 text-[#5d463a] sm:text-lg">
                  LearnHub is a modern online learning platform designed to help you gain new skills,
                  build confidence, and learn in a clear, focused, and motivating way.
                  </p>
                </Reveal>

                <Reveal delay={360} y={16} className="mt-8">
                  <div className="grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
                  {stats.map((stat) => (
                    <div key={stat.value} className="rounded-2xl border border-[#eedfcf] bg-[#fffaf5]/70 p-3 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md">
                      <div className="text-xl font-bold text-[#2a1e19]"><AnimatedCounter value={stat.label} /></div>
                      <div className="mt-1 text-[11px] leading-4 text-[#6f564b]">{stat.value}</div>
                    </div>
                  ))}
                  </div>
                </Reveal>
              </div>

              <div className="relative">
                <div className="absolute -left-10 top-8 h-32 w-32 rounded-full bg-[#f0dfc4] blur-3xl" />
                <div className="absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-[#efd1b5] blur-3xl" />
                <div className="relative overflow-hidden rounded-[28px] border border-[#ead6c0] bg-[#f2dfd0] p-3 shadow-[0_30px_60px_rgba(101,67,49,0.12)]">
                  <img
                    src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80"
                    alt="Student learning on a laptop"
                    className="h-[360px] w-full rounded-[22px] object-cover transition duration-700 hover:scale-[1.02] sm:h-[380px] lg:h-[370px]"
                  />
                  <div className="absolute right-8 top-6 rounded-2xl border border-[#f7e7d8] bg-white/80 px-4 py-3 shadow-lg backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#efe3d2] text-lg">💡</div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-[#7a4a2a]">Learn</div>
                        <div className="text-xl font-bold text-[#2d201b]">Grow</div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-8 left-8 rounded-2xl border border-[#f2eadf] bg-white/85 px-4 py-3 shadow-lg backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#3f2e29]">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f3dfd0] text-lg">🚀</span>
                      Join 50k+ learners
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        <section id="features" className="bg-[#f8f2eb] py-12">
          <Container size="xl">
            <Reveal className="mb-8">
            <div className="mb-8">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9a6f54]">Top features</span>
                <h2 className="mt-3 whitespace-nowrap text-3xl font-bold tracking-[-0.04em] text-[#291d1a] sm:text-4xl">
                  Learn with clarity and momentum.
                </h2>
              </div>
              <p className="mt-3 max-w-4xl text-base leading-7 text-[#5d463a]">
                Built for structured study, skill growth, and learner confidence across every stage of the journey.
              </p>
            </div>
            </Reveal>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              {highlights.map((item) => (
                <Reveal key={item.title} delay={100 * highlights.indexOf(item)} y={18}>
                <div className="h-full rounded-[22px] border border-[#ead8c6] bg-[#fffaf5] p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f3e3d2] text-2xl shadow-inner shadow-[#eedac2]">
                    {item.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-[#2e1f1d]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#644d42]">{item.text}</p>
                </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        <section id="about" className="bg-[#f8f2eb] py-14">
          <Container size="xl">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.92fr] lg:items-center">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9a6f54]">Why choose us</span>
                <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[#291d1a] sm:text-4xl">
                  Learning That Fits Your Life.
                </h2>
                <ul className="mt-6 space-y-4 text-base text-[#5d463a]">
                  <li className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#9a6f54]" />
                    Learn at your own pace with flexible study schedules.
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#9a6f54]" />
                    Follow clear, structured lessons that keep you focused.
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#9a6f54]" />
                    Build practical skills and confidence for your next step.
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#9a6f54]" />
                    Learn from expert instructors with real-world experience.
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#9a6f54]" />
                    Track your progress and celebrate every achievement.
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#9a6f54]" />
                    Access engaging lessons from any device, anywhere.
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#9a6f54]" />
                    Practice new concepts with clear, useful guidance.
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#9a6f54]" />
                    Earn certificates that showcase your learning progress.
                  </li>
                </ul>
              </div>
              <Reveal delay={180} y={18}>
              <div className="overflow-hidden rounded-[30px] border border-[#6d4028] bg-[#5a321f] p-5 text-[#fff9f0] shadow-[0_30px_60px_rgba(90,50,31,0.18)]">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] !text-[#f0d5b9]">Learn anytime</p>
                      <h3 className="mt-2 whitespace-nowrap text-3xl font-bold tracking-[-0.04em] !text-[#fff9f0]">Learn Anytime, Anywhere</h3>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f1d9b8] text-2xl text-[#31221d]">📚</div>
                  </div>

                  <img
                    src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=80"
                    alt="Student studying remotely"
                    className="h-48 w-full rounded-[20px] object-cover transition duration-700 hover:scale-[1.03]"
                  />

                  <ul className="mt-6 flex items-center justify-between gap-4 text-sm !text-[#f5e6d7]">
                    <li className="flex items-center gap-3 whitespace-nowrap"><span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#f2b67a]" /> Flexible schedule</li>
                    {/* <li className="flex items-center gap-3"><span className="inline-block h-2 w-2 rounded-full bg-[#f2b67a]" /> Guided, di
                    straction-free lessons</li> */}
                    <li className="flex items-center gap-3 whitespace-nowrap"><span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#f2b67a]" /> Works across devices</li>
                  </ul>

                  <LinkButton
                    href="/register"
                    variant="primary"
                    size="md"
                    className="mt-7 w-full rounded-full !bg-[#f1d9b8] !text-[#271c18] hover:!bg-[#e7c69d]"
                  >
                    Start Learning
                  </LinkButton>
              </div>
              </Reveal>
            </div>
          </Container>
        </section>

        <section className="bg-[#f8f2eb] py-14">
          <Container size="xl">
            <div className="mx-auto max-w-5xl">
              <Reveal delay={160} y={18}>
              <div id="faq" className="rounded-[28px] border border-[#ead8c6] bg-[#fffaf5] p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-3xl font-bold tracking-[-0.04em] text-[#291d1a]">Frequently Asked Questions</h3>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f1dfc9] text-2xl">💡</div>
                </div>

                <Accordion
                  items={faqItems}
                  defaultOpen={['what-is-learnhub']}
                  className="!border-[#ead8c6] !bg-[#f9f2eb] [&>div]:!border-[#ecdcc8] [&_button]:rounded-2xl [&_button]:px-4 [&_button]:py-4 [&_button:hover]:bg-[#f3e8dc] [&_button]:focus-visible:!ring-[#7a4a2e] [&_button>span:first-child]:!text-[#2d201b] [&_button>span:last-child]:!bg-[#f1dfc9] [&_button>span:last-child]:!text-[#7a4a2a] [&_button>span:last-child]:data-[open=true]:!bg-[#ead2b8] [&_div[role=region]>div]:px-4 [&_div[role=region]>div]:pb-4 [&_div[role=region]>div]:text-[#5d463a]"
                />
              </div>
              </Reveal>
            </div>
          </Container>
        </section>

        <section className="bg-[#f8f2eb] pb-12 pt-4">
          <Container size="xl">
            <Reveal>
            <div className="relative overflow-hidden rounded-[30px] border border-[#ead8c6] bg-[#d7c1a8] p-8 shadow-[0_30px_60px_rgba(60,37,27,0.18)]">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80')] bg-cover bg-center opacity-70" />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(25,18,15,0.66),rgba(51,35,28,0.2))]" />

              <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-xl text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f0d7ba]">Join thousands</p>
                  <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl">
                    Start your journey today.
                  </h2>
                </div>

                <div className="flex w-full justify-start lg:w-auto lg:justify-end">
                  <LinkButton
                    href="/register"
                    variant="primary"
                    size="md"
                    className="min-w-[150px] whitespace-nowrap rounded-full bg-[#201611] px-7 text-center text-white hover:bg-[#312521]"
                  >
                    Get Started
                  </LinkButton>
                </div>
              </div>
            </div>
            </Reveal>
          </Container>
        </section>
      </div>
    </MainLayout>
  );
}
