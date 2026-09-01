import { Prisma } from '@prisma/client';
import * as lessonRepo from '../repositories/lessonRepository';
import * as moduleRepo from '../repositories/moduleRepository';
import * as courseRepo from '../repositories/courseRepository';
import { assertCanManage, type ContentActor } from './contentAccess';

interface LessonRecord {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  content: string | null;
  type: string | null;
  resourceUrl: string | null;
  resourceMimeType: string | null;
  duration: number | null;
  order: number;
  isPreview: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface LessonListItemRecord {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  duration: number | null;
  order: number;
  isPreview: boolean;
  createdAt: Date;
}

function toLessonDto(lesson: LessonRecord) {
  return {
    id: lesson.id,
    moduleId: lesson.moduleId,
    title: lesson.title,
    description: lesson.description,
    content: lesson.content,
    type: lesson.type,
    resourceUrl: lesson.resourceUrl,
    resourceMimeType: lesson.resourceMimeType,
    duration: lesson.duration,
    order: lesson.order,
    isPreview: lesson.isPreview,
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt,
  };
}

function toLessonListItemDto(lesson: LessonListItemRecord) {
  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    type: lesson.type,
    duration: lesson.duration,
    order: lesson.order,
    isPreview: lesson.isPreview,
    createdAt: lesson.createdAt,
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

function optionalPositiveInt(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error('INVALID_DURATION');
  return parsed;
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

function requireBoolean(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return Boolean(value);
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
  return { module, course };
}

export async function listLessons(organizationId: string, courseId: string, moduleId: string) {
  await verifyModuleAccess(organizationId, courseId, moduleId);
  const lessons = await lessonRepo.listByModule(moduleId);
  return lessons.map(toLessonListItemDto);
}

export async function getLesson(organizationId: string, courseId: string, moduleId: string, lessonId: string) {
  await verifyModuleAccess(organizationId, courseId, moduleId);
  const lesson = await lessonRepo.getById(moduleId, lessonId);
  if (!lesson) {
    throw new Error('LESSON_NOT_FOUND');
  }
  return toLessonDto(lesson);
}

export async function createLesson(organizationId: string, courseId: string, moduleId: string, rawInput: unknown, actor?: ContentActor | null) {
  const { course } = await verifyModuleAccess(organizationId, courseId, moduleId);
  assertCanManage(actor, course);

  const input = (rawInput ?? {}) as Record<string, unknown>;

  const title = requireTitle(input.title);
  const order = requireOrder(input.order);

  try {
    const lesson = await lessonRepo.createLesson({
      moduleId,
      title,
      description: optionalString(input.description),
      content: optionalString(input.content),
      type: optionalString(input.type),
      resourceUrl: optionalString(input.resourceUrl),
      resourceMimeType: optionalString(input.resourceMimeType),
      duration: optionalPositiveInt(input.duration),
      order,
      isPreview: requireBoolean(input.isPreview),
    });
    return toLessonDto(lesson);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new Error('LESSON_ORDER_TAKEN');
    }
    throw err;
  }
}

export async function updateLesson(organizationId: string, courseId: string, moduleId: string, lessonId: string, rawInput: unknown, actor?: ContentActor | null) {
  const { course } = await verifyModuleAccess(organizationId, courseId, moduleId);
  assertCanManage(actor, course);

  const existingLesson = await lessonRepo.getById(moduleId, lessonId);
  if (!existingLesson) {
    throw new Error('LESSON_NOT_FOUND');
  }

  const input = (rawInput ?? {}) as Record<string, unknown>;
  const updateData: {
    title?: string;
    description?: string | null;
    content?: string | null;
    type?: string | null;
    resourceUrl?: string | null;
    resourceMimeType?: string | null;
    duration?: number | null;
    order?: number;
    isPreview?: boolean;
  } = {};

  if (input.title !== undefined) {
    updateData.title = requireTitle(input.title);
  }

  if (input.description !== undefined) {
    updateData.description = optionalString(input.description);
  }

  if (input.content !== undefined) {
    updateData.content = optionalString(input.content);
  }

  if (input.type !== undefined) {
    updateData.type = optionalString(input.type);
  }

  if (input.resourceUrl !== undefined) {
    updateData.resourceUrl = optionalString(input.resourceUrl);
  }

  if (input.resourceMimeType !== undefined) {
    updateData.resourceMimeType = optionalString(input.resourceMimeType);
  }

  if (input.duration !== undefined) {
    updateData.duration = optionalPositiveInt(input.duration);
  }

  if (input.order !== undefined) {
    updateData.order = requireOrder(input.order);
  }

  if (input.isPreview !== undefined) {
    updateData.isPreview = requireBoolean(input.isPreview);
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('MISSING_FIELDS');
  }

  try {
    const lesson = await lessonRepo.updateLesson(moduleId, lessonId, updateData);
    return toLessonDto(lesson);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new Error('LESSON_ORDER_TAKEN');
    }
    throw err;
  }
}

export async function deleteLesson(organizationId: string, courseId: string, moduleId: string, lessonId: string, actor?: ContentActor | null) {
  const { course } = await verifyModuleAccess(organizationId, courseId, moduleId);
  assertCanManage(actor, course);

  const existingLesson = await lessonRepo.getById(moduleId, lessonId);
  if (!existingLesson) {
    throw new Error('LESSON_NOT_FOUND');
  }

  await lessonRepo.deleteLesson(moduleId, lessonId);
  return { success: true };
}