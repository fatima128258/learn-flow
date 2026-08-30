import { MainLayout } from '@/components/layout/MainLayout';
import { Container } from '@/components/ui/layout/Container';
import { FAQAccordion } from '@/components/public/FAQAccordion';
import { SectionHeading } from '@/components/public/Section';
import { LinkButton } from '@/components/ui/LinkButton';
import { faqItems } from '@/lib/faqItems';

export const metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about LearnFlow — courses, progress tracking, certificates, and more.',
};

export default function FAQPage() {
  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        <section className="border-b border-neutral-100 bg-background-alt py-16 sm:py-20">
          <Container size="xl">
            <div className="mx-auto max-w-3xl text-center">
              <SectionHeading
                eyebrow="SUPPORT"
                title="Frequently asked questions"
                description="Everything you need to know about learning with LearnFlow."
                className="mb-0"
              />
            </div>
          </Container>
        </section>

        <section className="py-14 sm:py-20">
          <Container size="xl">
            <FAQAccordion items={faqItems} />
            <div className="mt-12 text-center">
              <p className="mb-4 text-neutral-600">Still have questions?</p>
              <LinkButton href="/contact" variant="primary" size="lg" showLoading loadingText="Loading...">
                Contact us
              </LinkButton>
            </div>
          </Container>
        </section>
      </div>
    </MainLayout>
  );
}
