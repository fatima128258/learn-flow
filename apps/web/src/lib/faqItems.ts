import type { AccordionItem } from '../components/public/Accordion';

/**
 * LearnFlow frequently asked questions.
 * Shared between the FAQ page and the Home page FAQ preview so the content
 * stays consistent (single source of truth).
 */
export const faqItems: AccordionItem[] = [
  {
    id: 'what-is-learnflow',
    question: 'What is LearnFlow?',
    answer:
      'LearnFlow is an online learning platform where learners enroll in structured courses, track their progress, take quizzes, and earn certificates. Instructors can create and manage courses, and organizations can manage their own learning programs.',
  },
  {
    id: 'how-to-start',
    question: 'How do I get started?',
    answer:
      'Click “Sign Up” to create a free account, then browse the course catalog and enroll in any course. Your progress is saved automatically so you can pick up right where you left off.',
  },
  {
    id: 'progress',
    question: 'How does progress tracking work?',
    answer:
      'As you complete lessons and quizzes, your dashboard updates with completion percentages and scores. This helps you see what you’ve finished and what’s next.',
  },
  {
    id: 'certificates',
    question: 'Do I get a certificate?',
    answer:
      'Yes. When you complete a course, you can earn a certificate of completion to recognize your achievement.',
  },
  {
    id: 'instructors',
    question: 'Can I create and teach courses?',
    answer:
      'Instructors can create courses, organize content into modules and lessons, and follow how their learners are progressing.',
  },
  {
    id: 'organizations',
    question: 'Does LearnFlow support organizations?',
    answer:
      'Yes. Organizations can manage their own learning programs, learners, and instructors within isolated environments.',
  },
];
