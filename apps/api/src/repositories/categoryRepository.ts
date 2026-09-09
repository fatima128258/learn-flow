import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

export interface CreateCategoryData {
  organizationId: string;
  name: string;
  slug: string;
  description?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface UpdateCategoryData {
  name?: string;
  slug?: string;
  description?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}

export function selectCategory() {
  return {
    id: true,
    organizationId: true,
    name: true,
    slug: true,
    description: true,
    status: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}

export async function create(data: CreateCategoryData) {
  return prisma().category.create({
    data: {
      organizationId: data.organizationId,
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      status: data.status ?? 'ACTIVE',
    },
    select: selectCategory(),
  });
}

export async function findByName(organizationId: string, name: string) {
  return prisma().category.findFirst({
    where: {
      organizationId,
      name: { equals: name, mode: 'insensitive' },
    },
    select: selectCategory(),
  });
}

export async function findByIdAndOrganization(organizationId: string, categoryId: string) {
  return prisma().category.findFirst({
    where: { id: categoryId, organizationId },
    select: {
      ...selectCategory(),
      _count: {
        select: { courses: true },
      },
      courses: {
        select: {
          instructorUser: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}

export async function listByOrganization(
  organizationId: string,
  options?: { search?: string; skip?: number; take?: number },
) {
  return prisma().category.findMany({
    where: {
      organizationId,
      ...(options?.search
        ? { name: { contains: options.search, mode: 'insensitive' } }
        : {}),
    },
    select: {
      ...selectCategory(),
      _count: {
        select: { courses: true },
      },
      courses: {
        select: {
          instructorUser: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: [{ name: 'asc' }],
    skip: options?.skip,
    take: options?.take,
  });
}

export async function listActiveByOrganization(organizationId: string) {
  return prisma().category.findMany({
    where: { organizationId, status: 'ACTIVE' },
    select: {
      ...selectCategory(),
    },
    orderBy: [{ name: 'asc' }],
  });
}

export async function countByOrganization(organizationId: string, search?: string) {
  return prisma().category.count({
    where: {
      organizationId,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    },
  });
}

export async function update(
  organizationId: string,
  categoryId: string,
  data: UpdateCategoryData,
) {
  const result = await prisma().category.updateMany({
    where: { id: categoryId, organizationId },
    data,
  });
  if (result.count === 0) {
    return null;
  }
  return prisma().category.findFirst({
    where: { id: categoryId, organizationId },
    select: selectCategory(),
  });
}

export async function remove(organizationId: string, categoryId: string) {
  const category = await prisma().category.findFirst({
    where: { id: categoryId, organizationId },
    select: { id: true, _count: { select: { courses: true } } },
  });
  if (!category) return { removed: false, inUse: false };
  if (category._count.courses > 0) return { removed: false, inUse: true };
  const result = await prisma().category.deleteMany({
    where: { id: categoryId, organizationId },
  });
  return { removed: result.count > 0, inUse: false };
}
