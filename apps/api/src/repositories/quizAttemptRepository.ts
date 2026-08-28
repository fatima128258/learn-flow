import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

export async function listByQuizAndUser(quizId: string, userId: string) {
  return prisma().quizAttempt.findMany({
    where: { quizId, userId },
    orderBy: { attemptNumber: 'asc' },
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
  score: number;
  correctCount: number;
  incorrectCount: number;
  percentage: number;
  passed: boolean;
}) {
  return prisma().quizAttempt.create({
    data: {
      quizId: data.quizId,
      userId: data.userId,
      attemptNumber: data.attemptNumber,
      score: data.score,
      correctCount: data.correctCount,
      incorrectCount: data.incorrectCount,
      percentage: data.percentage,
      passed: data.passed,
    },
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
