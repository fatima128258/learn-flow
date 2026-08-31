'use client';
import React, { useState } from 'react';
import { MainLayout } from '../../components/layout/MainLayout';
import { Container } from '../../components/ui/layout/Container';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/forms/Textarea';
import { FormField } from '../../components/forms/FormField';
import { useToast } from '../../components/ui/ToastProvider';

interface ContactFormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const initialState: ContactFormState = {
  name: '',
  email: '',
  subject: '',
  message: '',
};

const contactDetails = [
  {
    title: 'Email Us',
    value: 'support@learnflow.com',
    href: 'mailto:support@learnflow.com',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Call Us',
    value: '+1 (234) 567-8900',
    href: 'tel:+12345678900',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
  {
    title: 'Office Hours',
    value: 'Mon – Fri, 9:00 AM – 6:00 PM',
    href: undefined,
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function ContactPage() {
  const toast = useToast();
  const [form, setForm] = useState<ContactFormState>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof ContactFormState]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): string | null => {
    const next: Partial<Record<keyof ContactFormState, string>> = {};
    if (!form.name.trim()) next.name = 'Please enter your name';
    if (!form.email.trim()) next.email = 'Please enter your email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = 'Please enter a valid email address';
    if (!form.subject.trim()) next.subject = 'Please enter a subject';
    if (!form.message.trim()) next.message = 'Please enter a message';
    else if (form.message.trim().length < 10)
      next.message = 'Message should be at least 10 characters';
    setErrors(next);
    const firstErrorKey = (Object.keys(next) as (keyof ContactFormState)[])[0];
    return firstErrorKey ? next[firstErrorKey] ?? null : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSubmitting(true);
    // No backend contact endpoint is wired up yet; simulate submission.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setIsSubmitting(false);
    toast.success('Message sent!');
    setForm(initialState);
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="bg-primary-700">
          <Container size="xl" className="py-16 sm:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-4xl font-bold text-white tracking-tight sm:text-5xl">
                Get in touch
              </h1>
              <p className="mt-4 text-lg text-primary-100">
                Have questions? Send us a message and we’ll get back to you as soon as we can.
              </p>
            </div>
          </Container>
        </section>

        {/* Content */}
        <section className="py-12 sm:py-16">
          <Container size="xl">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Contact details */}
              <div className="space-y-4 lg:col-span-1">
                {contactDetails.map((detail) => (
                  <Card key={detail.title} padding="lg" className="border-2 border-transparent transition-all hover:border-primary-200">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
                        {detail.icon}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-neutral-900">{detail.title}</h3>
                        {detail.href ? (
                          <a href={detail.href} className="text-sm text-primary-600 hover:text-primary-700 transition-colors">
                            {detail.value}
                          </a>
                        ) : (
                          <p className="text-sm text-neutral-600">{detail.value}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Form */}
<Card padding="lg" className="lg:col-span-2">
                <h2 className="mb-6 text-2xl font-bold text-neutral-900">Send us a message</h2>

                <form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting} className="space-y-5">
                  <FormField label="Name" htmlFor="name" required error={errors.name}>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Jane Doe"
                      autoComplete="name"
                      disabled={isSubmitting}
                      error={errors.name}
                      aria-invalid={!!errors.name}
                    />
                  </FormField>

                  <FormField label="Email" htmlFor="email" required error={errors.email}>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="jane@example.com"
                      autoComplete="email"
                      disabled={isSubmitting}
                      error={errors.email}
                      aria-invalid={!!errors.email}
                    />
                  </FormField>

                  <FormField label="Subject" htmlFor="subject" required error={errors.subject}>
                    <Input
                      id="subject"
                      name="subject"
                      type="text"
                      value={form.subject}
                      onChange={handleChange}
                      placeholder="How can we help?"
                      disabled={isSubmitting}
                      error={errors.subject}
                      aria-invalid={!!errors.subject}
                    />
                  </FormField>

                  <FormField label="Message" htmlFor="message" required error={errors.message}>
                    <Textarea
                      id="message"
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      placeholder="Tell us a bit more about your inquiry..."
                      rows={6}
                      disabled={isSubmitting}
                      error={errors.message}
                      aria-invalid={!!errors.message}
                    />
                  </FormField>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={isSubmitting}
                    className="shadow-sm shadow-primary-200"
                  >
                    {isSubmitting ? 'Sending message...' : 'Send message'}
                  </Button>
                </form>
              </Card>
            </div>
          </Container>
        </section>
      </div>
    </MainLayout>
  );
}
