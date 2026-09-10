import { Prisma } from '@prisma/client';
import * as categoryRepo from '../repositories/categoryRepository';

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toCategoryDto(category: {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
  ownerUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { courses?: number };
  courses?: Array<{ instructorUser: { id: string; name: string | null; email: string } }>;
}) {
  const instructors = Array.from(new Map(
    (category.courses ?? []).map((course) => [course.instructorUser.id, {
      id: course.instructorUser.id,
      name: course.instructorUser.name?.trim() || course.instructorUser.email,
    }]),
  ).values());
  return {
    id: category.id,
    organizationId: category.organizationId,
    name: category.name,
    slug: category.slug,
    description: category.description ?? null,
    status: category.status ?? 'ACTIVE',
    ownerUserId: category.ownerUserId ?? null,
    courseCount: category._count?.courses ?? 0,
    instructors,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

async function assertNameAvailable(organizationId: string, name: string, excludeId?: string) {
  const existing = await categoryRepo.findByName(organizationId, name);
  if (existing && existing.id !== excludeId) {
    throw new Error('CATEGORY_NAME_TAKEN');
  }
}

function isUniqueViolation(err: unknown) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  );
}

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 1000;
const CATEGORY_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
type CategoryStatus = (typeof CATEGORY_STATUSES)[number];

function validateText(value: unknown, maxLength: number, required: boolean) {
  if (typeof value !== 'string') throw new Error('INVALID_INPUT');
  const trimmed = value.trim();
  if (required && !trimmed) throw new Error('INVALID_INPUT');
  if (trimmed.length > maxLength) throw new Error('INVALID_INPUT');
  return trimmed;
}

function validateStatus(value: unknown): CategoryStatus {
  if (typeof value !== 'string' || !CATEGORY_STATUSES.includes(value as CategoryStatus)) {
    throw new Error('INVALID_INPUT');
  }
  return value as CategoryStatus;
}

export async function createCategory(organizationId: string, rawInput: unknown) {
  const input = (rawInput ?? {}) as Record<string, unknown>;

  const name = validateText(input.name, MAX_NAME_LENGTH, true);

  let description: string | null = null;
  if (input.description !== undefined && input.description !== null && input.description !== '') {
    description = validateText(input.description, MAX_DESCRIPTION_LENGTH, false) || null;
  }
  const status = input.status === undefined ? 'ACTIVE' : validateStatus(input.status);

  await assertNameAvailable(organizationId, name);

  try {
    const category = await categoryRepo.create({
      organizationId,
      name,
      slug: slugify(name) || 'category',
      description,
      status,
    });
    return toCategoryDto(category);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new Error('CATEGORY_NAME_TAKEN');
    }
    throw err;
  }
}

export async function listCategories(
  organizationId: string,
  options?: { search?: string; page?: number; limit?: number },
) {
  const search = options?.search?.trim() || undefined;
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  const page = Math.max(options?.page ?? 1, 1);
  const [categories, total] = await Promise.all([
    categoryRepo.listByOrganization(organizationId, {
      search,
      skip: (page - 1) * limit,
      take: limit,
    }),
    categoryRepo.countByOrganization(organizationId, search),
  ]);
  return { items: categories.map(toCategoryDto), page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function getCategory(organizationId: string, categoryId: string) {
  const category = await categoryRepo.findByIdAndOrganization(organizationId, categoryId);
  if (!category) throw new Error('CATEGORY_NOT_FOUND');
  return toCategoryDto(category);
}

export async function listAssignableCategories(organizationId: string, actor?: { id: string; role?: string }) {
  const categories = await categoryRepo.listActiveAssignable(organizationId, actor?.id, actor?.role === 'INSTRUCTOR');
  return categories.map(toCategoryDto);
}

export async function assertAssignableCategory(
  organizationId: string,
  categoryId: string,
  actor?: { id: string; role?: string },
) {
  const category = await categoryRepo.findAssignable(organizationId, categoryId, actor?.id ?? '', actor?.role === 'INSTRUCTOR');
  if (!category) throw new Error('CATEGORY_NOT_FOUND');
  if (category.status !== 'ACTIVE') throw new Error('CATEGORY_INACTIVE');
  return category.id;
}

export async function createPrivateCategory(organizationId: string, userId: string, rawInput: unknown) {
  const input = (rawInput ?? {}) as Record<string, unknown>;
  const name = validateText(input.name, MAX_NAME_LENGTH, true);
  const description = input.description === undefined || input.description === null || input.description === ''
    ? null
    : validateText(input.description, MAX_DESCRIPTION_LENGTH, false) || null;
  const status = input.status === undefined ? 'ACTIVE' : validateStatus(input.status);
  await assertPrivateNameAvailable(organizationId, userId, name);
  try {
    const category = await categoryRepo.create({
      organizationId, ownerUserId: userId, name, slug: slugify(name) || 'category', description, status,
    });
    return toCategoryDto(category);
  } catch (err) {
    if (isUniqueViolation(err)) throw new Error('CATEGORY_NAME_TAKEN');
    throw err;
  }
}

export async function getPrivateCategory(organizationId: string, userId: string, categoryId: string) {
  const category = await categoryRepo.findPrivateById(organizationId, userId, categoryId);
  if (!category) throw new Error('CATEGORY_NOT_FOUND');
  return toCategoryDto(category);
}

export async function updatePrivateCategory(organizationId: string, userId: string, categoryId: string, rawInput: unknown) {
  const existing = await categoryRepo.findPrivateById(organizationId, userId, categoryId);
  if (!existing) throw new Error('CATEGORY_NOT_FOUND');
  const input = (rawInput ?? {}) as Record<string, unknown>;
  const name = validateText(input.name, MAX_NAME_LENGTH, true);
  const description = input.description === undefined || input.description === null || input.description === ''
    ? null
    : validateText(input.description, MAX_DESCRIPTION_LENGTH, false) || null;
  const status = input.status === undefined ? existing.status ?? 'ACTIVE' : validateStatus(input.status);
  await assertPrivateNameAvailable(organizationId, userId, name, categoryId);
  const updated = await categoryRepo.updatePrivate(organizationId, userId, categoryId, {
    name,
    slug: slugify(name) || 'category',
    description,
    status,
  });
  if (!updated) throw new Error('CATEGORY_NOT_FOUND');
  return toCategoryDto(updated);
}

export async function updateCategory(
  organizationId: string,
  categoryId: string,
  rawInput: unknown,
) {
  const input = (rawInput ?? {}) as Record<string, unknown>;

  const existing = await categoryRepo.findByIdAndOrganization(organizationId, categoryId);
  if (!existing) {
    throw new Error('CATEGORY_NOT_FOUND');
  }

  let name = existing.name;
  if (input.name !== undefined && input.name !== null && input.name !== '') {
    name = validateText(input.name, MAX_NAME_LENGTH, true);
  }

  let description: string | null = existing.description ?? null;
  if (input.description !== undefined) {
    if (input.description === null || input.description === '') {
      description = null;
    } else {
      description = validateText(input.description, MAX_DESCRIPTION_LENGTH, false) || null;
    }
  }
  const status = input.status === undefined ? existing.status : validateStatus(input.status);

  if (name !== existing.name) {
    await assertNameAvailable(organizationId, name, existing.id);
  }

  try {
    const updated = await categoryRepo.update(organizationId, categoryId, {
      name,
      slug: name !== existing.name ? slugify(name) || 'category' : existing.slug,
      description,
      status,
    });
    if (!updated) {
      throw new Error('CATEGORY_NOT_FOUND');
    }
    return toCategoryDto(updated);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new Error('CATEGORY_NAME_TAKEN');
    }
    throw err;
  }
}

export async function deleteCategory(organizationId: string, categoryId: string) {
  const result = await categoryRepo.remove(organizationId, categoryId);
  if (result.inUse) throw new Error('CATEGORY_IN_USE');
  if (!result.removed) {
    throw new Error('CATEGORY_NOT_FOUND');
  }
  return { deleted: true };
}

export async function resolveOrCreateCategoryId(
  organizationId: string,
  name: string,
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) {
    return null;
  }

  const existing = await categoryRepo.findByName(organizationId, trimmed);
  if (existing) {
    return existing.id;
  }

  try {
    const created = await categoryRepo.create({
      organizationId,
      name: trimmed,
      slug: slugify(trimmed) || 'category',
      description: null,
    });
    return created.id;
  } catch (err) {
    if (isUniqueViolation(err)) {
      const existingNow = await categoryRepo.findByName(organizationId, trimmed);
      return existingNow?.id ?? null;
    }
    throw err;
  }
}

async function assertPrivateNameAvailable(organizationId: string, userId: string, name: string, excludeId?: string) {
  const existing = await categoryRepo.findByName(organizationId, name, userId);
  if (existing && existing.id !== excludeId) throw new Error('CATEGORY_NAME_TAKEN');
}
