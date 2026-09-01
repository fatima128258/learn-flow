import { Prisma } from '@prisma/client';
import * as questionRepo from '../repositories/questionRepository';
import * as quizRepo from '../repositories/quizRepository';
import * as courseRepo from '../repositories/courseRepository';
import { assertCanManage, type ContentActor } from './contentAccess';

interface OptionRecord {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

interface QuestionRecord {
  id: string;
  quizId: string;
  questionText: string;
  marks: number;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  options?: OptionRecord[];
}

function toQuestionDto(question: QuestionRecord) {
  return {
    id: question.id,
    quizId: question.quizId,
    questionText: question.questionText,
    marks: question.marks,
    order: question.order,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
}

function toQuestionDetailDto(question: QuestionRecord) {
  return {
    id: question.id,
    quizId: question.quizId,
    questionText: question.questionText,
    marks: question.marks,
    order: question.order,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    options: question.options?.map(toOptionDto) ?? [],
  };
}

function toOptionDto(option: OptionRecord) {
  return {
    id: option.id,
    questionId: option.questionId,
    text: option.text,
    isCorrect: option.isCorrect,
    order: option.order,
    createdAt: option.createdAt,
    updatedAt: option.updatedAt,
  };
}

function requireQuestionText(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('MISSING_FIELDS');
  }
  return value.trim();
}

function requireOrder(value: unknown) {
  if (value === undefined || value === null) {
    throw new Error('MISSING_FIELDS');
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('INVALID_ORDER');
  }
  return parsed;
}

function requireMarks(value: unknown) {
  if (value === undefined || value === null) {
    return 1;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('INVALID_VALUE');
  }
  return parsed;
}

function requireOptionText(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('MISSING_FIELDS');
  }
  return value.trim();
}

function requireBoolean(value: unknown) {
  if (typeof value !== 'boolean') {
    throw new Error('INVALID_VALUE');
  }
  return value;
}

export async function verifyQuizAccess(organizationId: string, courseId: string, moduleId: string, quizId: string) {
  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }
  const module = await (await import('../repositories/moduleRepository')).getById(courseId, moduleId);
  if (!module) {
    throw new Error('MODULE_NOT_FOUND');
  }
  const quiz = await quizRepo.getById(moduleId, quizId);
  if (!quiz) {
    throw new Error('QUIZ_NOT_FOUND');
  }
  return { quiz, course };
}

export async function listQuestions(organizationId: string, courseId: string, moduleId: string, quizId: string) {
  await verifyQuizAccess(organizationId, courseId, moduleId, quizId);
  const questions = await questionRepo.listByQuiz(quizId);
  return questions.map(toQuestionDto);
}

export async function getQuestion(organizationId: string, courseId: string, moduleId: string, quizId: string, questionId: string) {
  await verifyQuizAccess(organizationId, courseId, moduleId, quizId);
  const question = await questionRepo.getById(quizId, questionId);
  if (!question) {
    throw new Error('QUESTION_NOT_FOUND');
  }
  return toQuestionDetailDto(question);
}

export async function createQuestion(organizationId: string, courseId: string, moduleId: string, quizId: string, rawInput: unknown, actor?: ContentActor | null) {
  const { course } = await verifyQuizAccess(organizationId, courseId, moduleId, quizId);
  assertCanManage(actor, course);

  const input = (rawInput ?? {}) as Record<string, unknown>;

  const questionText = requireQuestionText(input.questionText);
  const order = requireOrder(input.order);
  const marks = requireMarks(input.marks);

  try {
    const question = await questionRepo.createQuestion({
      quizId,
      questionText,
      marks,
      order,
    });
    return toQuestionDto(question);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new Error('QUESTION_ORDER_TAKEN');
    }
    throw err;
  }
}

export async function updateQuestion(organizationId: string, courseId: string, moduleId: string, quizId: string, questionId: string, rawInput: unknown, actor?: ContentActor | null) {
  const { course } = await verifyQuizAccess(organizationId, courseId, moduleId, quizId);
  assertCanManage(actor, course);

  const existingQuestion = await questionRepo.getById(quizId, questionId);
  if (!existingQuestion) {
    throw new Error('QUESTION_NOT_FOUND');
  }

  const input = (rawInput ?? {}) as Record<string, unknown>;
  const updateData: {
    questionText?: string;
    marks?: number;
    order?: number;
  } = {};

  if (input.questionText !== undefined) {
    updateData.questionText = requireQuestionText(input.questionText);
  }

  if (input.marks !== undefined) {
    updateData.marks = requireMarks(input.marks);
  }

  if (input.order !== undefined) {
    updateData.order = requireOrder(input.order);
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('MISSING_FIELDS');
  }

  try {
    const question = await questionRepo.updateQuestion(quizId, questionId, updateData);
    return toQuestionDto(question);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new Error('QUESTION_ORDER_TAKEN');
    }
    throw err;
  }
}

export async function deleteQuestion(organizationId: string, courseId: string, moduleId: string, quizId: string, questionId: string, actor?: ContentActor | null) {
  const { course } = await verifyQuizAccess(organizationId, courseId, moduleId, quizId);
  assertCanManage(actor, course);

  const existingQuestion = await questionRepo.getById(quizId, questionId);
  if (!existingQuestion) {
    throw new Error('QUESTION_NOT_FOUND');
  }

  await questionRepo.deleteQuestion(quizId, questionId);
  return { success: true };
}

export async function listOptions(organizationId: string, courseId: string, moduleId: string, quizId: string, questionId: string) {
  await verifyQuizAccess(organizationId, courseId, moduleId, quizId);

  const existingQuestion = await questionRepo.getById(quizId, questionId);
  if (!existingQuestion) {
    throw new Error('QUESTION_NOT_FOUND');
  }

  const options = await questionRepo.listOptionsByQuestion(questionId);
  return options.map(toOptionDto);
}

export async function createOption(organizationId: string, courseId: string, moduleId: string, quizId: string, questionId: string, rawInput: unknown, actor?: ContentActor | null) {
  const { course } = await verifyQuizAccess(organizationId, courseId, moduleId, quizId);
  assertCanManage(actor, course);

  const existingQuestion = await questionRepo.getById(quizId, questionId);
  if (!existingQuestion) {
    throw new Error('QUESTION_NOT_FOUND');
  }

  const input = (rawInput ?? {}) as Record<string, unknown>;

  const text = requireOptionText(input.text);
  const isCorrect = input.isCorrect !== undefined ? requireBoolean(input.isCorrect) : false;
  const order = requireOrder(input.order);

  try {
    const option = await questionRepo.createOption({
      questionId,
      text,
      isCorrect,
      order,
    });
    return toOptionDto(option);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new Error('OPTION_ORDER_TAKEN');
    }
    throw err;
  }
}

export async function updateOption(organizationId: string, courseId: string, moduleId: string, quizId: string, questionId: string, optionId: string, rawInput: unknown, actor?: ContentActor | null) {
  const { course } = await verifyQuizAccess(organizationId, courseId, moduleId, quizId);
  assertCanManage(actor, course);

  const existingQuestion = await questionRepo.getById(quizId, questionId);
  if (!existingQuestion) {
    throw new Error('QUESTION_NOT_FOUND');
  }

  const existingOption = await questionRepo.getOptionById(questionId, optionId);
  if (!existingOption) {
    throw new Error('OPTION_NOT_FOUND');
  }

  const input = (rawInput ?? {}) as Record<string, unknown>;
  const updateData: {
    text?: string;
    isCorrect?: boolean;
    order?: number;
  } = {};

  if (input.text !== undefined) {
    updateData.text = requireOptionText(input.text);
  }

  if (input.isCorrect !== undefined) {
    updateData.isCorrect = requireBoolean(input.isCorrect);
  }

  if (input.order !== undefined) {
    updateData.order = requireOrder(input.order);
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('MISSING_FIELDS');
  }

  try {
    const option = await questionRepo.updateOption(questionId, optionId, updateData);
    return toOptionDto(option);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new Error('OPTION_ORDER_TAKEN');
    }
    throw err;
  }
}

export async function deleteOption(organizationId: string, courseId: string, moduleId: string, quizId: string, questionId: string, optionId: string, actor?: ContentActor | null) {
  const { course } = await verifyQuizAccess(organizationId, courseId, moduleId, quizId);
  assertCanManage(actor, course);

  const existingQuestion = await questionRepo.getById(quizId, questionId);
  if (!existingQuestion) {
    throw new Error('QUESTION_NOT_FOUND');
  }

  const existingOption = await questionRepo.getOptionById(questionId, optionId);
  if (!existingOption) {
    throw new Error('OPTION_NOT_FOUND');
  }

  await questionRepo.deleteOption(questionId, optionId);
  return { success: true };
}
