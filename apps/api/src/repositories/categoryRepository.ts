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
  ownerUserId?: string | null;
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
    ownerUserId: true,
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
      ownerUserId: data.ownerUserId ?? null,
    },
    select: selectCategory(),
  });
}

export async function findByName(organizationId: string, name: string, ownerUserId: string | null = null) {
  return prisma().category.findFirst({
    where: {
      organizationId,
      ownerUserId,
      name: { equals: name, mode: 'insensitive' },
    },
    select: selectCategory(),
  });
}

export async function findByIdAndOrganization(organizationId: string, categoryId: string) {
  return prisma().category.findFirst({
    where: { id: categoryId, organizationId, ownerUserId: null },
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

export async function findPrivateById(organizationId: string, ownerUserId: string, categoryId: string) {
  return prisma().category.findFirst({
    where: { id: categoryId, organizationId, ownerUserId },
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
      ownerUserId: null,
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

export async function listActiveAssignable(organizationId: string, userId?: string, isInstructor = false) {
  return prisma().category.findMany({
    where: { organizationId, status: 'ACTIVE', ...(isInstructor ? { OR: [{ ownerUserId: null }, { ownerUserId: userId }] } : { ownerUserId: null }) },
    select: {
      ...selectCategory(),
    },
    orderBy: [{ name: 'asc' }],
  });
}

export async function countByOrganization(organizationId: string, search?: string) {
  return prisma().category.count({
    where: {
      organizationId, ownerUserId: null,
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
    where: { id: categoryId, organizationId, ownerUserId: null },
    data,
  });
  if (result.count === 0) {
    return null;
  }

  return prisma().category.findFirst({
    where: { id: categoryId, organizationId, ownerUserId: null },
    select: selectCategory(),
  });
}

export async function updatePrivate(
  organizationId: string,
  ownerUserId: string,
  categoryId: string,
  data: UpdateCategoryData,
) {
  const result = await prisma().category.updateMany({
    where: { id: categoryId, organizationId, ownerUserId },
    data,
  });
  if (result.count === 0) return null;
  return findPrivateById(organizationId, ownerUserId, categoryId);
}

export async function remove(organizationId: string, categoryId: string) {
  const category = await prisma().category.findFirst({
    where: { id: categoryId, organizationId, ownerUserId: null },
    select: { id: true, _count: { select: { courses: true } } },
  });
  if (!category) return { removed: false, inUse: false };
  if (category._count.courses > 0) return { removed: false, inUse: true };
  const result = await prisma().category.deleteMany({
    where: { id: categoryId, organizationId, ownerUserId: null },
  });
  return { removed: result.count > 0, inUse: false };
}

export async function findAssignable(organizationId: string, categoryId: string, userId: string, isInstructor: boolean) {
  return prisma().category.findFirst({ where: { id: categoryId, organizationId, ...(isInstructor ? { OR: [{ ownerUserId: null }, { ownerUserId: userId }] } : { ownerUserId: null }) }, select: selectCategory() });
}
