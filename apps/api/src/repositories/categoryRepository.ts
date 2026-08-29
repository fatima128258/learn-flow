import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

export interface CreateCategoryData {
  organizationId: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface UpdateCategoryData {
  name?: string;
  slug?: string;
  description?: string | null;
}

export function selectCategory() {
  return {
    id: true,
    organizationId: true,
    name: true,
    slug: true,
    description: true,
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
    },
  });
}

export async function findByName(organizationId: string, name: string) {
  return prisma().category.findFirst({
    where: {
      organizationId,
      name: { equals: name, mode: 'insensitive' },
    },
  });
}

export async function findByIdAndOrganization(organizationId: string, categoryId: string) {
  return prisma().category.findFirst({
    where: { id: categoryId, organizationId },
  });
}

export async function listByOrganization(organizationId: string) {
  return prisma().category.findMany({
    where: { organizationId },
    include: {
      _count: {
        select: { courses: true },
      },
    },
    orderBy: [{ name: 'asc' }],
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
  });
}

export async function remove(organizationId: string, categoryId: string) {
  const result = await prisma().category.deleteMany({
    where: { id: categoryId, organizationId },
  });
  return result.count > 0;
}