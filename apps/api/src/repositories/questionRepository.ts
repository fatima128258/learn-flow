import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

export interface CreateQuestionData {
  quizId: string;
  questionText: string;
  marks: number;
  order: number;
}

export interface UpdateQuestionData {
  questionText?: string;
  marks?: number;
  order?: number;
}

export async function listByQuiz(quizId: string) {
  return prisma().question.findMany({
    where: { quizId },
    select: {
      id: true,
      quizId: true,
      questionText: true,
      marks: true,
      order: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { order: 'asc' },
  });
}

export async function getById(quizId: string, questionId: string) {
  return prisma().question.findFirst({
    where: { id: questionId, quizId },
    include: {
      options: {
        orderBy: { order: 'asc' },
      },
    },
  });
}

export async function createQuestion(data: CreateQuestionData) {
  return prisma().question.create({
    data: {
      quizId: data.quizId,
      questionText: data.questionText,
      marks: data.marks,
      order: data.order,
    },
  });
}

export async function updateQuestion(quizId: string, questionId: string, data: UpdateQuestionData) {
  // Use updateMany so the WHERE clause is atomically bound to BOTH questionId AND
  // quizId. A plain update({ where: { id } }) would mutate any question in the
  // database regardless of which quiz it belongs to.
  const result = await prisma().question.updateMany({
    where: { id: questionId, quizId },
    data,
  });
  if (result.count === 0) {
    return null;
  }
  return prisma().question.findFirst({
    where: { id: questionId, quizId },
    include: {
      options: {
        orderBy: { order: 'asc' },
      },
    },
  });
}

export async function deleteQuestion(quizId: string, questionId: string) {
  // Use deleteMany so the WHERE clause is atomically bound to BOTH questionId AND
  // quizId. A plain delete({ where: { id } }) would delete any question in the
  // database regardless of which quiz it belongs to.
  const result = await prisma().question.deleteMany({
    where: { id: questionId, quizId },
  });
  return result;
}

export async function getQuizOwnerId(quizId: string) {
  const quiz = await prisma().quiz.findUnique({
    where: { id: quizId },
    select: { moduleId: true },
  });
  return quiz;
}

export async function getQuestionOwnerId(questionId: string) {
  const question = await prisma().question.findUnique({
    where: { id: questionId },
    select: { quizId: true },
  });
  return question;
}

export interface CreateOptionData {
  questionId: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

export interface UpdateOptionData {
  text?: string;
  isCorrect?: boolean;
  order?: number;
}

export async function listOptionsByQuestion(questionId: string) {
  return prisma().quizOption.findMany({
    where: { questionId },
    select: {
      id: true,
      questionId: true,
      text: true,
      isCorrect: true,
      order: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { order: 'asc' },
  });
}

export async function getOptionById(questionId: string, optionId: string) {
  return prisma().quizOption.findFirst({
    where: { id: optionId, questionId },
  });
}

export async function createOption(data: CreateOptionData) {
  return prisma().quizOption.create({
    data: {
      questionId: data.questionId,
      text: data.text,
      isCorrect: data.isCorrect,
      order: data.order,
    },
  });
}

export async function updateOption(questionId: string, optionId: string, data: UpdateOptionData) {
  // Use updateMany so the WHERE clause is atomically bound to BOTH optionId AND
  // questionId. A plain update({ where: { id } }) would mutate any option in the
  // database regardless of which question it belongs to.
  const result = await prisma().quizOption.updateMany({
    where: { id: optionId, questionId },
    data,
  });
  if (result.count === 0) {
    return null;
  }
  return prisma().quizOption.findFirst({
    where: { id: optionId, questionId },
  });
}

export async function deleteOption(questionId: string, optionId: string) {
  // Use deleteMany so the WHERE clause is atomically bound to BOTH optionId AND
  // questionId. A plain delete({ where: { id } }) would delete any option in the
  // database regardless of which question it belongs to.
  const result = await prisma().quizOption.deleteMany({
    where: { id: optionId, questionId },
  });
  return result;
}
