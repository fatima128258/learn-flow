import { MainLayout } from '@/components/layout/MainLayout';

export default function FAQPage() {
  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Frequently Asked Questions</h1>
        <div className="space-y-6">
          {[
            {
              q: 'What is Personal Study Mentor?',
              a: 'Personal Study Mentor is an online learning platform that helps you organize courses, track progress, and achieve your educational goals.',
            },
            {
              q: 'Is it free to use?',
              a: 'Yes! You can sign up for free and access a wide range of courses and features.',
            },
            {
              q: 'How do I get started?',
              a: 'Simply click the Sign Up button, create your account, and start exploring courses right away.',
            },
          ].map((item) => (
            <div key={item.q} className="border border-slate-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">{item.q}</h2>
              <p className="text-slate-600">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
