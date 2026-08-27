import { Prisma } from '@prisma/client';
import * as quizRepo from '../repositories/quizRepository';
import * as moduleRepo from '../repositories/moduleRepository';
import * as courseRepo from '../repositories/courseRepository';

function toQuizDto(quiz: any) {
  return {
    id: quiz.id,
    moduleId: quiz.moduleId,
    title: quiz.title,
    description: quiz.description,
    timeLimitMinutes: quiz.timeLimitMinutes,
    passingPercentage: quiz.passingPercentage,
    maxAttempts: quiz.maxAttempts,
    order: quiz.order,
    createdAt: quiz.createdAt,
    updatedAt: quiz.updatedAt,
  };
}

function toQuizListItemDto(quiz: any) {
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    timeLimitMinutes: quiz.timeLimitMinutes,
    passingPercentage: quiz.passingPercentage,
    maxAttempts: quiz.maxAttempts,
    order: quiz.order,
    createdAt: quiz.createdAt,
  };
}

function requireTitle(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('MISSING_FIELDS');
  }
  return value.trim();
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error('MISSING_FIELDS');
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

function optionalPositiveInt(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('INVALID_VALUE');
  }
  return parsed;
}

function optionalNonNegativeFloat(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (isNaN(parsed) || parsed < 0 || parsed > 100) {
    throw new Error('INVALID_VALUE');
  }
  return parsed;
}

export async function verifyModuleAccess(organizationId: string, courseId: string, moduleId: string) {
  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }
  const module = await moduleRepo.getById(courseId, moduleId);
  if (!module) {
    throw new Error('MODULE_NOT_FOUND');
  }
  return module;
}

export async function listQuizzes(organizationId: string, courseId: string, moduleId: string) {
  await verifyModuleAccess(organizationId, courseId, moduleId);
  const quizzes = await quizRepo.listByModule(moduleId);
  return quizzes.map(toQuizListItemDto);
}

export async function getQuiz(organizationId: string, courseId: string, moduleId: string, quizId: string) {
  await verifyModuleAccess(organizationId, courseId, moduleId);
  const quiz = await quizRepo.getById(moduleId, quizId);
  if (!quiz) {
    throw new Error('QUIZ_NOT_FOUND');
  }
  return toQuizDto(quiz);
}

export async function createQuiz(organizationId: string, courseId: string, moduleId: string, rawInput: unknown) {
  await verifyModuleAccess(organizationId, courseId, moduleId);

  const input = (rawInput ?? {}) as Record<string, unknown>;

  const title = requireTitle(input.title);
  const order = requireOrder(input.order);

  try {
    const quiz = await quizRepo.createQuiz({
      moduleId,
      title,
      description: optionalString(input.description),
      timeLimitMinutes: optionalPositiveInt(input.timeLimitMinutes),
      passingPercentage: optionalNonNegativeFloat(input.passingPercentage),
      maxAttempts: optionalPositiveInt(input.maxAttempts),
      order,
    });
    return toQuizDto(quiz);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new Error('QUIZ_ORDER_TAKEN');
    }
    throw err;
  }
}

export async function updateQuiz(organizationId: string, courseId: string, moduleId: string, quizId: string, rawInput: unknown) {
  await verifyModuleAccess(organizationId, courseId, moduleId);

  const existingQuiz = await quizRepo.getById(moduleId, quizId);
  if (!existingQuiz) {
    throw new Error('QUIZ_NOT_FOUND');
  }

  const input = (rawInput ?? {}) as Record<string, unknown>;
  const updateData: {
    title?: string;
    description?: string | null;
    timeLimitMinutes?: number | null;
    passingPercentage?: number | null;
    maxAttempts?: number | null;
    order?: number;
  } = {};

  if (input.title !== undefined) {
    updateData.title = requireTitle(input.title);
  }

  if (input.description !== undefined) {
    updateData.description = optionalString(input.description);
  }

  if (input.timeLimitMinutes !== undefined) {
    updateData.timeLimitMinutes = optionalPositiveInt(input.timeLimitMinutes);
  }

  if (input.passingPercentage !== undefined) {
    updateData.passingPercentage = optionalNonNegativeFloat(input.passingPercentage);
  }

  if (input.maxAttempts !== undefined) {
    updateData.maxAttempts = optionalPositiveInt(input.maxAttempts);
  }

  if (input.order !== undefined) {
    updateData.order = requireOrder(input.order);
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('MISSING_FIELDS');
  }

  try {
    const quiz = await quizRepo.updateQuiz(moduleId, quizId, updateData);
    return toQuizDto(quiz);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new Error('QUIZ_ORDER_TAKEN');
    }
    throw err;
  }
}

export async function deleteQuiz(organizationId: string, courseId: string, moduleId: string, quizId: string) {
  await verifyModuleAccess(organizationId, courseId, moduleId);

  const existingQuiz = await quizRepo.getById(moduleId, quizId);
  if (!existingQuiz) {
    throw new Error('QUIZ_NOT_FOUND');
  }

  await quizRepo.deleteQuiz(moduleId, quizId);
  return { success: true };
}
