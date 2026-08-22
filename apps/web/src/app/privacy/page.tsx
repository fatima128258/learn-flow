import React from 'react';
import { MainLayout } from '../../components/layout/MainLayout';
import { Container } from '../../components/ui/layout/Container';

export default function PrivacyPage() {
  return (
    <MainLayout>
      <div className="min-h-screen bg-white py-16">
        <Container size="md">
          <article className="prose prose-lg max-w-none animate-fade-in">
            <h1 className="text-4xl font-bold text-neutral-900 mb-8">Privacy Policy</h1>
            
            <p className="text-lg text-neutral-600 mb-8">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-4">Introduction</h2>
              <p className="text-neutral-700 leading-relaxed">
                At LearnFlow, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, 
                and safeguard your information when you use our learning management platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-4">Information We Collect</h2>
              <p className="text-neutral-700 leading-relaxed mb-4">
                We collect information that you provide directly to us, including:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-neutral-700">
                <li>Name, email address, and account credentials</li>
                <li>Profile information and preferences</li>
                <li>Course enrollment and progress data</li>
                <li>Payment and billing information</li>
                <li>Communications with us</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-4">How We Use Your Information</h2>
              <p className="text-neutral-700 leading-relaxed mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-neutral-700">
                <li>Provide, maintain, and improve our services</li>
                <li>Process your transactions and send related information</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Monitor and analyze trends and usage</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-4">Data Security</h2>
              <p className="text-neutral-700 leading-relaxed">
                We implement appropriate technical and organizational security measures to protect your personal information. 
                However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-4">Your Rights</h2>
              <p className="text-neutral-700 leading-relaxed mb-4">
                You have the right to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-neutral-700">
                <li>Access and receive a copy of your personal data</li>
                <li>Correct inaccurate or incomplete data</li>
                <li>Request deletion of your data</li>
                <li>Object to or restrict processing of your data</li>
                <li>Withdraw consent at any time</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-4">Contact Us</h2>
              <p className="text-neutral-700 leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us at{' '}
                <a href="mailto:privacy@learnflow.com" className="text-primary-600 hover:text-primary-700 underline">
                  privacy@learnflow.com
                </a>
              </p>
            </section>
          </article>
        </Container>
      </div>
    </MainLayout>
  );
}
