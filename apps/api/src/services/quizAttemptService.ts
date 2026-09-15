import * as courseRepo from '../repositories/courseRepository';
import * as moduleRepo from '../repositories/moduleRepository';
import * as quizRepo from '../repositories/quizRepository';
import * as enrollmentRepo from '../repositories/enrollmentRepository';
import * as quizAttemptRepo from '../repositories/quizAttemptRepository';
import { assertContentUnlocked } from './sequentialAccess';
import * as progressService from './progressService';

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

interface QuizTakingQuestionOption {
  id: string;
  text: string;
  order: number;
}

interface QuizTakingQuestion {
  id: string;
  questionText: string;
  marks: number;
  order: number;
  options: QuizTakingQuestionOption[];
}

interface QuizTakingRecord {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  timeLimitMinutes: number | null;
  passingPercentage: number | null;
  maxAttempts: number | null;
  order: number;
  questions: QuizTakingQuestion[];
}

function toQuizTakingDto(
  quiz: QuizTakingRecord,
  attemptCount: number,
  maxAttempts: number | null,
  activeAttempt: {
    id: string;
    attemptNumber: number;
    startedAt: Date;
    expiresAt: Date | null;
  } | null,
) {
  const attemptsRemaining =
    maxAttempts == null ? null : Math.max(0, maxAttempts - attemptCount);

  return {
    id: quiz.id,
    moduleId: quiz.moduleId,
    title: quiz.title,
    description: quiz.description,
    timeLimitMinutes: quiz.timeLimitMinutes,
    passingPercentage: quiz.passingPercentage,
    maxAttempts: quiz.maxAttempts,
    order: quiz.order,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      questionText: question.questionText,
      marks: question.marks,
      order: question.order,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        order: option.order,
      })),
    })),
    attempts: {
      used: attemptCount,
      remaining: attemptsRemaining,
    },
    activeAttempt: activeAttempt
      ? {
          attemptId: activeAttempt.id,
          attemptNumber: activeAttempt.attemptNumber,
          startedAt: activeAttempt.startedAt,
          expiresAt: activeAttempt.expiresAt,
        }
      : null,
  };
}

async function getValidInProgressAttempt(quizId: string, userId: string) {
  const attempt = await quizAttemptRepo.findInProgressAttempt(quizId, userId);
  if (attempt?.expiresAt && new Date() >= attempt.expiresAt) {
    await quizAttemptRepo.expireAttempt(attempt.id);
    return null;
  }
  return attempt;
}

async function verifyQuizAttemptAccess(
  organizationId: string,
  userId: string,
  courseId: string,
  moduleId: string,
  quizId: string,
) {
  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }

  const enrollment = await enrollmentRepo.findByUserAndCourse(userId, courseId);
  if (!enrollment) {
    throw new Error('STUDENT_NOT_ENROLLED');
  }
  if (enrollment.organizationId !== organizationId) {
    throw new Error('STUDENT_NOT_ENROLLED');
  }
  if (enrollment.status && enrollment.status !== 'ACTIVE') {
    throw new Error('STUDENT_NOT_ENROLLED');
  }

  const module = await moduleRepo.getById(courseId, moduleId);
  if (!module) {
    throw new Error('MODULE_NOT_FOUND');
  }

  const quiz = await quizRepo.getById(moduleId, quizId);
  if (!quiz) {
    throw new Error('QUIZ_NOT_FOUND');
  }

  await assertContentUnlocked(userId, courseId, moduleId, 'QUIZ', quizId);

  return { course, module, quiz };
}

export async function getQuizForTaking(
  organizationId: string,
  userId: string,
  courseId: string,
  moduleId: string,
  quizId: string,
) {
  await verifyQuizAttemptAccess(organizationId, userId, courseId, moduleId, quizId);

  const [quiz, attemptCount, existingAttempt] = await Promise.all([
    quizAttemptRepo.getQuizWithQuestionsForTaking(quizId),
    quizAttemptRepo.countByQuizAndUser(quizId, userId),
    getValidInProgressAttempt(quizId, userId),
  ]);

  if (!quiz) {
    throw new Error('QUIZ_NOT_FOUND');
  }

  return toQuizTakingDto(quiz, attemptCount, quiz.maxAttempts, existingAttempt);
}

export async function startQuizAttempt(
  organizationId: string,
  userId: string,
  courseId: string,
  moduleId: string,
  quizId: string,
) {
  const { quiz } = await verifyQuizAttemptAccess(
    organizationId,
    userId,
    courseId,
    moduleId,
    quizId,
  );
  const existing = await getValidInProgressAttempt(quizId, userId);
  if (existing) {
    return {
      attemptId: existing.id,
      attemptNumber: existing.attemptNumber,
      startedAt: existing.startedAt,
      expiresAt: existing.expiresAt,
    };
  }

  const attemptCount = await quizAttemptRepo.countByQuizAndUser(quizId, userId);
  if (quiz.maxAttempts != null && attemptCount >= quiz.maxAttempts) {
    throw new Error('MAX_ATTEMPTS_REACHED');
  }

  const startedAt = new Date();
  const expiresAt = quiz.timeLimitMinutes == null
    ? null
    : new Date(startedAt.getTime() + quiz.timeLimitMinutes * 60_000);
  try {
    const attempt = await quizAttemptRepo.createAttempt({
      quizId,
      userId,
      attemptNumber: attemptCount + 1,
      expiresAt,
    });
    return {
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
    };
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      const concurrentAttempt = await quizAttemptRepo.findInProgressAttempt(quizId, userId);
      if (concurrentAttempt) {
        return {
          attemptId: concurrentAttempt.id,
          attemptNumber: concurrentAttempt.attemptNumber,
          startedAt: concurrentAttempt.startedAt,
          expiresAt: concurrentAttempt.expiresAt,
        };
      }
      throw new Error('ATTEMPT_ALREADY_SUBMITTED');
    }
    if (err instanceof Error && err.message === 'ATTEMPT_ALREADY_SUBMITTED') {
      throw err;
    }
    throw err;
  }
}

export async function submitQuizAttempt(
  organizationId: string,
  userId: string,
  courseId: string,
  moduleId: string,
  quizId: string,
  rawInput: unknown,
) {
  await verifyQuizAttemptAccess(
    organizationId,
    userId,
    courseId,
    moduleId,
    quizId,
  );

  if (rawInput === undefined || rawInput === null || typeof rawInput !== 'object') {
    throw new Error('MISSING_FIELDS');
  }

  const input = rawInput as Record<string, unknown>;
  const rawAnswers = input.answers;

  if (!Array.isArray(rawAnswers) || rawAnswers.length === 0) {
    throw new Error('MISSING_FIELDS');
  }

  const answers = new Map<string, string>();
  for (const entry of rawAnswers as unknown[]) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('INVALID_ANSWERS');
    }
    const item = entry as Record<string, unknown>;
    if (typeof item.questionId !== 'string' || typeof item.optionId !== 'string') {
      throw new Error('INVALID_ANSWERS');
    }
    if (answers.has(item.questionId)) {
      throw new Error('INVALID_ANSWERS');
    }
    answers.set(item.questionId, item.optionId);
  }

  const quiz = await quizAttemptRepo.getQuizWithQuestionsForGrading(quizId);
  if (!quiz) {
    throw new Error('QUIZ_NOT_FOUND');
  }

  const questions = quiz.questions ?? [];
  if (questions.length === 0) {
    throw new Error('QUIZ_HAS_NO_QUESTIONS');
  }

  const attemptCount = await quizAttemptRepo.countByQuizAndUser(quizId, userId);
  const attempt: {
    id: string;
    attemptNumber: number;
    startedAt: Date;
    expiresAt: Date | null;
  } | null = await quizAttemptRepo.findInProgressAttempt(quizId, userId);
  if (attempt && attempt.expiresAt && new Date() >= attempt.expiresAt) {
    await quizAttemptRepo.expireAttempt(attempt.id);
    throw new Error('ATTEMPT_EXPIRED');
  }
  if (!attempt && quiz.maxAttempts != null && attemptCount >= quiz.maxAttempts) {
    throw new Error('MAX_ATTEMPTS_REACHED');
  }

  const correctLookup = new Map<string, Set<string>>();
  const validOptionLookup = new Map<string, Set<string>>();
  for (const question of questions) {
    const correctIds = new Set<string>();
    const optionIds = new Set<string>();
    for (const option of question.options ?? []) {
      optionIds.add(option.id);
      if (option.isCorrect) correctIds.add(option.id);
    }
    correctLookup.set(question.id, correctIds);
    validOptionLookup.set(question.id, optionIds);
  }

  // Do not accept answers for another quiz/question, or an option belonging
  // to another question. Apart from being a correctness issue this prevents
  // callers from probing or influencing records outside this quiz.
  if (questions.some((question) => !answers.has(question.id))) {
    throw new Error('ALL_QUESTIONS_REQUIRED');
  }
  if (answers.size !== questions.length ||
      questions.some((question) =>
        !validOptionLookup.get(question.id)?.has(answers.get(question.id)!))) {
    throw new Error('INVALID_ANSWERS');
  }

  if (!attempt) {
    throw new Error('ATTEMPT_NOT_STARTED');
  }
  const attemptNumber = attempt.attemptNumber;

  let score = 0;
  let correctCount = 0;
  const totalMarks = questions.reduce((sum, q) => sum + (q.marks ?? 0), 0);

  for (const question of questions) {
    const selectedOptionId = answers.get(question.id);
    if (selectedOptionId === undefined) throw new Error('ALL_QUESTIONS_REQUIRED');
    const correctIds = correctLookup.get(question.id);
    if (correctIds && correctIds.has(selectedOptionId)) {
      score += question.marks ?? 0;
      correctCount += 1;
    }
  }

  const incorrectCount = questions.length - correctCount;
  const percentage = totalMarks > 0 ? round2((score / totalMarks) * 100) : 0;
  const passingPercentage = quiz.passingPercentage;
  const passed = passingPercentage == null ? percentage >= 100 : percentage >= passingPercentage;

  try {
    const completedAttempt = await quizAttemptRepo.completeAttempt(attempt.id, {
      score,
      correctCount,
      incorrectCount,
      percentage,
      passed,
    });

    // Recalculate after every submitted attempt. Failed attempts remain
    // incomplete, but later lesson/module activity must continue contributing
    // to progress and course completion must remain false until the quiz passes.
    await progressService.refreshCourseProgressAfterQuiz(
      organizationId,
      userId,
      courseId,
    );

    return {
      attemptId: completedAttempt.id,
      attemptNumber,
      score: completedAttempt.score,
      correctCount: completedAttempt.correctCount,
      incorrectCount: completedAttempt.incorrectCount,
      percentage: completedAttempt.percentage,
      passed: completedAttempt.passed,
      submittedAt: completedAttempt.submittedAt,
      passingPercentage,
      totalMarks,
      totalQuestions: questions.length,
      attemptsRemaining: quiz.maxAttempts == null ? null : Math.max(0, quiz.maxAttempts - attemptNumber),
    };
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      throw new Error('ATTEMPT_ALREADY_SUBMITTED');
    }
    throw err;
  }
}

export async function getQuizResults(
  organizationId: string,
  userId: string,
  courseId: string,
  moduleId: string,
  quizId: string,
) {
  const { quiz } = await verifyQuizAttemptAccess(organizationId, userId, courseId, moduleId, quizId);
  const [attempts, gradingQuiz] = await Promise.all([
    quizAttemptRepo.listResultsByQuizAndUser(quizId, userId),
    quizAttemptRepo.getQuizWithQuestionsForGrading(quizId),
  ]);
  const totalQuestions = gradingQuiz?.questions.length ?? 0;
  return attempts.map((attempt) => ({
    attemptId: attempt.id,
    attemptNumber: attempt.attemptNumber,
    score: attempt.score,
    correctCount: attempt.correctCount,
    incorrectCount: attempt.incorrectCount,
    percentage: attempt.percentage,
    passed: attempt.passed,
    submittedAt: attempt.submittedAt,
    passingPercentage: attempt.quiz.passingPercentage,
    totalQuestions,
    attemptsRemaining: quiz.maxAttempts == null
      ? null
      : Math.max(0, quiz.maxAttempts - attempt.attemptNumber),
  }));
}
