import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

export async function listByQuizAndUser(quizId: string, userId: string) {
  return prisma().quizAttempt.findMany({
    where: { quizId, userId, status: 'COMPLETED' },
    orderBy: { attemptNumber: 'asc' },
  });
}

/** Attempts are always scoped to both the quiz and authenticated student. */
export async function listResultsByQuizAndUser(quizId: string, userId: string) {
  return prisma().quizAttempt.findMany({
    where: { quizId, userId },
    orderBy: { attemptNumber: 'desc' },
    select: {
      id: true,
      quizId: true,
      userId: true,
      attemptNumber: true,
      score: true,
      correctCount: true,
      incorrectCount: true,
      percentage: true,
      passed: true,
      submittedAt: true,
      status: true,
      quiz: { select: { passingPercentage: true } },
    },
  });
}

export async function countByQuizAndUser(quizId: string, userId: string) {
  return prisma().quizAttempt.count({
    where: { quizId, userId },
  });
}

export async function createAttempt(data: {
  quizId: string;
  userId: string;
  attemptNumber: number;
  expiresAt: Date | null;
}) {
  return prisma().quizAttempt.create({
    data: {
      quizId: data.quizId,
      userId: data.userId,
      attemptNumber: data.attemptNumber,
      expiresAt: data.expiresAt,
    },
  });
}

export async function findInProgressAttempt(quizId: string, userId: string) {
  return prisma().quizAttempt.findFirst({
    where: { quizId, userId, status: 'IN_PROGRESS' },
    orderBy: { attemptNumber: 'desc' },
  });
}

export async function findById(id: string) {
  return prisma().quizAttempt.findUnique({ where: { id } });
}

export async function completeAttempt(
  attemptId: string,
  data: {
    score: number;
    correctCount: number;
    incorrectCount: number;
    percentage: number;
    passed: boolean;
  },
) {
  const result = await prisma().quizAttempt.updateMany({
    where: { id: attemptId, status: 'IN_PROGRESS' },
    data: {
      ...data,
      status: 'COMPLETED',
      submittedAt: new Date(),
    },
  });
  if (result.count !== 1) {
    throw new Error('ATTEMPT_ALREADY_SUBMITTED');
  }
  const attempt = await findById(attemptId);
  if (!attempt) {
    throw new Error('ATTEMPT_NOT_FOUND');
  }
  return attempt;
}

export async function expireAttempt(attemptId: string) {
  return prisma().quizAttempt.update({
    where: { id: attemptId },
    data: { status: 'EXPIRED' },
  });
}

export async function getQuizWithQuestionsForTaking(quizId: string) {
  return prisma().quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          questionText: true,
          marks: true,
          order: true,
          options: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              text: true,
              order: true,
            },
          },
        },
      },
    },
  });
}

export async function getQuizWithQuestionsForGrading(quizId: string) {
  return prisma().quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          marks: true,
          options: {
            select: {
              id: true,
              isCorrect: true,
            },
          },
        },
      },
    },
  });
}
