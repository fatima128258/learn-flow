import * as courseRepo from '../repositories/courseRepository';
import * as moduleRepo from '../repositories/moduleRepository';
import * as quizRepo from '../repositories/quizRepository';
import * as enrollmentRepo from '../repositories/enrollmentRepository';
import * as quizAttemptRepo from '../repositories/quizAttemptRepository';

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function toQuizTakingDto(quiz: any, attemptCount: number, maxAttempts: number | null) {
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
    questions: quiz.questions.map((question: any) => ({
      id: question.id,
      questionText: question.questionText,
      marks: question.marks,
      order: question.order,
      options: question.options.map((option: any) => ({
        id: option.id,
        text: option.text,
        order: option.order,
      })),
    })),
    attempts: {
      used: attemptCount,
      remaining: attemptsRemaining,
    },
  };
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

  const module = await moduleRepo.getById(courseId, moduleId);
  if (!module) {
    throw new Error('MODULE_NOT_FOUND');
  }

  const quiz = await quizRepo.getById(moduleId, quizId);
  if (!quiz) {
    throw new Error('QUIZ_NOT_FOUND');
  }

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

  const [quiz, attemptCount] = await Promise.all([
    quizAttemptRepo.getQuizWithQuestionsForTaking(quizId),
    quizAttemptRepo.countByQuizAndUser(quizId, userId),
  ]);

  if (!quiz) {
    throw new Error('QUIZ_NOT_FOUND');
  }

  return toQuizTakingDto(quiz, attemptCount, quiz.maxAttempts);
}

export async function submitQuizAttempt(
  organizationId: string,
  userId: string,
  courseId: string,
  moduleId: string,
  quizId: string,
  rawInput: unknown,
) {
  await verifyQuizAttemptAccess(organizationId, userId, courseId, moduleId, quizId);

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

  if (quiz.maxAttempts != null && attemptCount >= quiz.maxAttempts) {
    throw new Error('MAX_ATTEMPTS_REACHED');
  }

  const attemptNumber = attemptCount + 1;

  const correctLookup = new Map<string, Set<string>>();
  for (const question of questions) {
    const correctIds = new Set<string>();
    for (const option of question.options ?? []) {
      if (option.isCorrect) correctIds.add(option.id);
    }
    correctLookup.set(question.id, correctIds);
  }

  let score = 0;
  let correctCount = 0;
  const totalMarks = questions.reduce((sum, q) => sum + (q.marks ?? 0), 0);

  for (const question of questions) {
    const selectedOptionId = answers.get(question.id);
    if (selectedOptionId === undefined) {
      throw new Error('ALL_QUESTIONS_REQUIRED');
    }
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
    const attempt = await quizAttemptRepo.createAttempt({
      quizId,
      userId,
      attemptNumber,
      score,
      correctCount,
      incorrectCount,
      percentage,
      passed,
    });

    return {
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      score: attempt.score,
      correctCount: attempt.correctCount,
      incorrectCount: attempt.incorrectCount,
      percentage: attempt.percentage,
      passed: attempt.passed,
      submittedAt: attempt.submittedAt,
      passingPercentage,
      totalMarks,
    };
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw new Error('ATTEMPT_ALREADY_SUBMITTED');
    }
    throw err;
  }
}
