import React from 'react';
import { MainLayout } from '../../components/layout/MainLayout';
import { Container } from '../../components/ui/layout/Container';

export default function TermsPage() {
  return (
    <MainLayout>
      <div className="min-h-screen bg-white py-16">
        <Container size="md">
          <article className="prose prose-lg max-w-none animate-fade-in">
            <h1 className="text-4xl font-bold text-neutral-900 mb-8">Terms of Service</h1>
            
            <p className="text-lg text-neutral-600 mb-8">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-4">Agreement to Terms</h2>
              <p className="text-neutral-700 leading-relaxed">
                By accessing or using LearnFlow, you agree to be bound by these Terms of Service and all applicable laws and regulations. 
                If you do not agree with any of these terms, you are prohibited from using or accessing this platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-4">Use License</h2>
              <p className="text-neutral-700 leading-relaxed mb-4">
                Permission is granted to temporarily access the materials on LearnFlow for personal, non-commercial use only. 
                This is the grant of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-neutral-700">
                <li>Modify or copy the materials</li>
                <li>Use the materials for any commercial purpose</li>
                <li>Attempt to decompile or reverse engineer any software</li>
                <li>Remove any copyright or proprietary notations</li>
                <li>Transfer the materials to another person</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-4">Account Responsibilities</h2>
              <p className="text-neutral-700 leading-relaxed mb-4">
                When you create an account with us, you must provide accurate and complete information. You are responsible for:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-neutral-700">
                <li>Maintaining the security of your account and password</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized use</li>
                <li>Ensuring your account information is current</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-4">Content Ownership</h2>
              <p className="text-neutral-700 leading-relaxed">
                All course materials, including but not limited to videos, text, images, and other content on LearnFlow, 
                are the property of their respective owners and are protected by copyright and other intellectual property laws.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-4">Prohibited Activities</h2>
              <p className="text-neutral-700 leading-relaxed mb-4">
                You may not use LearnFlow to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-neutral-700">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on intellectual property rights</li>
                <li>Transmit harmful or malicious code</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Engage in unauthorized commercial activities</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-4">Limitation of Liability</h2>
              <p className="text-neutral-700 leading-relaxed">
                LearnFlow shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting 
                from your use of or inability to use the service, even if we have been advised of the possibility of such damages.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-4">Changes to Terms</h2>
              <p className="text-neutral-700 leading-relaxed">
                We reserve the right to modify these terms at any time. We will notify users of any material changes. 
                Your continued use of LearnFlow after such modifications constitutes your acceptance of the updated terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-4">Contact Us</h2>
              <p className="text-neutral-700 leading-relaxed">
                If you have any questions about these Terms of Service, please contact us at{' '}
                <a href="mailto:legal@learnflow.com" className="text-primary-600 hover:text-primary-700 underline">
                  legal@learnflow.com
                </a>
              </p>
            </section>
          </article>
        </Container>
      </div>
    </MainLayout>
  );
}
