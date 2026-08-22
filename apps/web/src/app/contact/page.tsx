'use client';
import React, { useState } from 'react';
import { MainLayout } from '../../components/layout/MainLayout';
import { Container } from '../../components/ui/layout/Container';
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setSubmitted(true);
    setFormData({ name: '', email: '', subject: '', message: '' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
        {/* Hero Section */}
        <section className="relative py-20 sm:py-28 bg-gradient-to-br from-primary-600 to-primary-800 overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0YzAtMi4yMSAxLjc5LTQgNC00czQgMS43OSA0IDR2MmMwIDIuMjEtMS43OSA0LTQgNHMtNC0xLjc5LTQtNHYtMnptMC0zMGMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0djJjMCAyLjIxLTEuNzkgNC00IDRzLTQtMS43OS00LTRWNHpNNiAzNGMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0djJjMCAyLjIxLTEuNzkgNC00IDRzLTQtMS43OS00LTR2LTJ6bTAtMzBjMC0yLjIxIDEuNzktNCA0LTRzNCAxLjc5IDQgNHYyYzAgMi4yMS0xLjc5IDQtNCA0cy00LTEuNzktNC00VjR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
          
          <Container className="relative">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight animate-slide-up">
                Get in Touch
              </h1>
              <p className="text-xl text-primary-100 leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
                Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
              </p>
            </div>
          </Container>
        </section>

        {/* Contact Content */}
        <section className="py-20">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              {/* Contact Information */}
              <div className="lg:col-span-1 space-y-6">
                <Card className="border-2 hover:border-primary-200 transition-all animate-slide-up">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center mb-4">
                      <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <CardTitle className="mb-2">Email Us</CardTitle>
                    <CardDescription className="text-base">
                      <a href="mailto:support@learnflow.com" className="text-primary-600 hover:text-primary-700 transition-colors">
                        support@learnflow.com
                      </a>
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="border-2 hover:border-success-200 transition-all animate-slide-up" style={{ animationDelay: '0.1s' }}>
                  <CardHeader>
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-success-50 to-success-100 flex items-center justify-center mb-4">
                      <svg className="h-6 w-6 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <CardTitle className="mb-2">Call Us</CardTitle>
                    <CardDescription className="text-base">
                      <a href="tel:+1234567890" className="text-success-600 hover:text-success-700 transition-colors">
                        +1 (234) 567-8900
                      </a>
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="border-2 hover:border-warning-200 transition-all animate-slide-up" style={{ animationDelay: '0.2s' }}>
                  <CardHeader>
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-warning-50 to-warning-100 flex items-center justify-center mb-4">
                      <svg className="h-6 w-6 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <CardTitle className="mb-2">Visit Us</CardTitle>
                    <CardDescription className="text-base">
                      123 Learning Street<br />
                      San Francisco, CA 94102<br />
                      United States
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="border-2 hover:border-purple-200 transition-all animate-slide-up" style={{ animationDelay: '0.3s' }}>
                  <CardHeader>
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center mb-4">
                      <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <CardTitle className="mb-2">Office Hours</CardTitle>
                    <CardDescription className="text-base">
                      Monday - Friday<br />
                      9:00 AM - 6:00 PM PST
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>

              {/* Contact Form */}
              <div className="lg:col-span-2">
                <Card className="border-2 animate-slide-up" style={{ animationDelay: '0.4s' }}>
                  <CardHeader>
                    <CardTitle className="text-2xl mb-2">Send us a message</CardTitle>
                    <CardDescription className="text-base mb-6">
                      Fill out the form below and we'll get back to you within 24 hours.
                    </CardDescription>

                    {submitted && (
                      <div className="mb-6 p-4 bg-success-50 border-2 border-success-200 rounded-lg animate-fade-in">
                        <div className="flex items-start gap-3">
                          <svg className="h-6 w-6 text-success-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <h4 className="font-semibold text-success-900 mb-1">Message sent successfully!</h4>
                            <p className="text-sm text-success-700">We'll get back to you as soon as possible.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div>
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          name="name"
                          type="text"
                          required
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="John Doe"
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="john@example.com"
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label htmlFor="subject">Subject *</Label>
                        <Input
                          id="subject"
                          name="subject"
                          type="text"
                          required
                          value={formData.subject}
                          onChange={handleChange}
                          placeholder="How can we help?"
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label htmlFor="message">Message *</Label>
                        <textarea
                          id="message"
                          name="message"
                          required
                          value={formData.message}
                          onChange={handleChange}
                          placeholder="Tell us more about your inquiry..."
                          rows={6}
                          className="mt-2 w-full px-3 py-2 border border-neutral-300 rounded-lg shadow-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-neutral-50 disabled:cursor-not-allowed transition-colors"
                        />
                      </div>

                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        fullWidth
                        loading={isSubmitting}
                        className="shadow-lg shadow-primary-200"
                      >
                        {isSubmitting ? 'Sending message...' : 'Send Message'}
                      </Button>
                    </form>
                  </CardHeader>
                </Card>
              </div>
            </div>
          </Container>
        </section>
      </div>
    </MainLayout>
  );
}
