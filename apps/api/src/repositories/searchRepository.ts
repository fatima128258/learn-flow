import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

export interface SearchFilters {
  query?: string;
  category?: string;
  difficulty?: string;
}

export interface SearchOptions {
  skip?: number;
  take?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

function buildWhere(organizationId: string, filters: SearchFilters) {
  const query = filters.query?.trim();
  const where: any = {
    organizationId,
    status: 'PUBLISHED',
  };

  if (query) {
    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
    ];
  }

  if (filters.category) {
    where.category = { name: filters.category };
  }

  if (filters.difficulty) {
    where.difficulty = filters.difficulty;
  }

  return where;
}

export async function searchPublishedCourses(
  organizationId: string,
  filters: SearchFilters,
  options: SearchOptions = {},
) {
  return prisma().course.findMany({
    where: buildWhere(organizationId, filters),
    include: {
      instructorUser: {
        select: {
          id: true,
          name: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: options.orderBy ?? { publishedAt: 'desc' },
    skip: options.skip,
    take: options.take,
  });
}

export async function countPublishedCourses(organizationId: string, filters: SearchFilters) {
  return prisma().course.count({
    where: buildWhere(organizationId, filters),
  });
}

export async function getPublishedCourseById(organizationId: string, courseId: string) {
  return prisma().course.findFirst({
    where: {
      id: courseId,
      organizationId,
      status: 'PUBLISHED',
    },
    include: {
      instructorUser: {
        select: {
          id: true,
          name: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
}
