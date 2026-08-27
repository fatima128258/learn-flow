import { Prisma } from '@prisma/client';
import * as moduleRepo from '../repositories/moduleRepository';
import * as courseRepo from '../repositories/courseRepository';

function toModuleDto(module: any) {
  return {
    id: module.id,
    courseId: module.courseId,
    title: module.title,
    description: module.description,
    order: module.order,
    createdAt: module.createdAt,
    updatedAt: module.updatedAt,
  };
}

function toModuleListItemDto(module: any) {
  return {
    id: module.id,
    title: module.title,
    description: module.description,
    order: module.order,
    createdAt: module.createdAt,
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

export async function verifyCourseAccess(organizationId: string, courseId: string) {
  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }
  return course;
}

export async function listModules(organizationId: string, courseId: string) {
  await verifyCourseAccess(organizationId, courseId);
  const modules = await moduleRepo.listByCourse(courseId);
  return modules.map(toModuleListItemDto);
}

export async function getModule(organizationId: string, courseId: string, moduleId: string) {
  await verifyCourseAccess(organizationId, courseId);
  const module = await moduleRepo.getById(courseId, moduleId);
  if (!module) {
    throw new Error('MODULE_NOT_FOUND');
  }
  return toModuleDto(module);
}

export async function createModule(organizationId: string, courseId: string, rawInput: unknown) {
  await verifyCourseAccess(organizationId, courseId);

  const input = (rawInput ?? {}) as Record<string, unknown>;

  const title = requireTitle(input.title);
  const order = requireOrder(input.order);

  try {
    const module = await moduleRepo.createModule({
      courseId,
      title,
      description: optionalString(input.description),
      order,
    });
    return toModuleDto(module);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new Error('MODULE_ORDER_TAKEN');
    }
    throw err;
  }
}

export async function updateModule(organizationId: string, courseId: string, moduleId: string, rawInput: unknown) {
  await verifyCourseAccess(organizationId, courseId);

  const existingModule = await moduleRepo.getById(courseId, moduleId);
  if (!existingModule) {
    throw new Error('MODULE_NOT_FOUND');
  }

  const input = (rawInput ?? {}) as Record<string, unknown>;
  const updateData: { title?: string; description?: string | null; order?: number } = {};

  if (input.title !== undefined) {
    updateData.title = requireTitle(input.title);
  }

  if (input.description !== undefined) {
    updateData.description = optionalString(input.description);
  }

  if (input.order !== undefined) {
    updateData.order = requireOrder(input.order);
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('MISSING_FIELDS');
  }

  try {
    const module = await moduleRepo.updateModule(courseId, moduleId, updateData);
    return toModuleDto(module);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new Error('MODULE_ORDER_TAKEN');
    }
    throw err;
  }
}

export async function deleteModule(organizationId: string, courseId: string, moduleId: string) {
  await verifyCourseAccess(organizationId, courseId);

  const existingModule = await moduleRepo.getById(courseId, moduleId);
  if (!existingModule) {
    throw new Error('MODULE_NOT_FOUND');
  }

  await moduleRepo.deleteModule(courseId, moduleId);
  return { success: true };
}