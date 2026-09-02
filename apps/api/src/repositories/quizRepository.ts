import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

export interface CreateQuizData {
  moduleId: string;
  title: string;
  description?: string | null;
  timeLimitMinutes?: number | null;
  passingPercentage?: number | null;
  maxAttempts?: number | null;
  order: number;
}

export async function createQuiz(data: CreateQuizData) {
  return prisma().quiz.create({
    data: {
      moduleId: data.moduleId,
      title: data.title,
      description: data.description,
      timeLimitMinutes: data.timeLimitMinutes,
      passingPercentage: data.passingPercentage,
      maxAttempts: data.maxAttempts,
      order: data.order,
    },
  });
}

export async function listByModule(moduleId: string) {
  return prisma().quiz.findMany({
    where: { moduleId },
    select: {
      id: true,
      title: true,
      description: true,
      timeLimitMinutes: true,
      passingPercentage: true,
      maxAttempts: true,
      order: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { order: 'asc' },
  });
}

export async function getById(moduleId: string, quizId: string) {
  return prisma().quiz.findFirst({
    where: { id: quizId, moduleId },
  });
}

export async function updateQuiz(moduleId: string, quizId: string, data: {
  title?: string;
  description?: string | null;
  timeLimitMinutes?: number | null;
  passingPercentage?: number | null;
  maxAttempts?: number | null;
  order?: number;
}) {
  // Use updateMany so the WHERE clause is atomically bound to BOTH quizId AND
  // moduleId. A plain update({ where: { id } }) would mutate any quiz in the
  // database regardless of which module it belongs to.
  const result = await prisma().quiz.updateMany({
    where: { id: quizId, moduleId },
    data,
  });
  if (result.count === 0) {
    return null;
  }
  return prisma().quiz.findFirst({ where: { id: quizId, moduleId } });
}

export async function deleteQuiz(moduleId: string, quizId: string) {
  // Use deleteMany so the WHERE clause is atomically bound to BOTH quizId AND
  // moduleId. A plain delete({ where: { id } }) would delete any quiz in the
  // database regardless of which module it belongs to.
  const result = await prisma().quiz.deleteMany({
    where: { id: quizId, moduleId },
  });
  return result;
}
