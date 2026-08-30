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
  createdAt: Date;
  updatedAt: Date;
  _count?: { courses?: number };
}) {
  return {
    id: category.id,
    organizationId: category.organizationId,
    name: category.name,
    slug: category.slug,
    description: category.description ?? null,
    courseCount: category._count?.courses ?? 0,
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

export async function createCategory(organizationId: string, rawInput: unknown) {
  const input = (rawInput ?? {}) as Record<string, unknown>;

  if (typeof input.name !== 'string' || !input.name.trim()) {
    throw new Error('MISSING_FIELDS');
  }
  const name = input.name.trim();

  let description: string | null = null;
  if (input.description !== undefined && input.description !== null && input.description !== '') {
    if (typeof input.description !== 'string') throw new Error('MISSING_FIELDS');
    description = input.description.trim();
  }

  await assertNameAvailable(organizationId, name);

  try {
    const category = await categoryRepo.create({
      organizationId,
      name,
      slug: slugify(name) || 'category',
      description,
    });
    return toCategoryDto(category);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new Error('CATEGORY_NAME_TAKEN');
    }
    throw err;
  }
}

export async function listCategories(organizationId: string) {
  const categories = await categoryRepo.listByOrganization(organizationId);
  return categories.map(toCategoryDto);
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
    if (typeof input.name !== 'string') throw new Error('MISSING_FIELDS');
    name = input.name.trim();
  }

  let description: string | null = existing.description ?? null;
  if (input.description !== undefined) {
    if (input.description === null || input.description === '') {
      description = null;
    } else {
      if (typeof input.description !== 'string') throw new Error('MISSING_FIELDS');
      description = input.description.trim();
    }
  }

  if (name !== existing.name) {
    await assertNameAvailable(organizationId, name, existing.id);
  }

  try {
    const updated = await categoryRepo.update(organizationId, categoryId, {
      name,
      slug: name !== existing.name ? slugify(name) || 'category' : existing.slug,
      description,
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
  const removed = await categoryRepo.remove(organizationId, categoryId);
  if (!removed) {
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