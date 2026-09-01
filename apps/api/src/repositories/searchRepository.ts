import getPrisma from '../prisma';
import { Prisma } from '@prisma/client';

function prisma() {
  return getPrisma();
}

export interface SearchFilters {
  query?: string;
  category?: string;
  difficulty?: string;
  instructor?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface SearchOptions {
  skip?: number;
  take?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

function buildWhere(organizationId: string, filters: SearchFilters) {
  const query = filters.query?.trim();
  const where: Prisma.CourseWhereInput = {
    organizationId,
    status: 'PUBLISHED',
  };

  // Text search: title OR description must match
  if (query) {
    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
    ];
  }

  // Category filter
  if (filters.category) {
    where.category = { name: filters.category };
  }

  // Difficulty filter
  if (filters.difficulty) {
    where.difficulty = filters.difficulty;
  }

  // Instructor filter
  if (filters.instructor) {
    where.instructorUser = {
      is: { name: { contains: filters.instructor, mode: 'insensitive' } },
    };
  }

  // Price filter: must be applied as AND condition, not added to OR
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const priceRange: Prisma.DecimalFilter = {};
    if (filters.minPrice !== undefined) priceRange.gte = filters.minPrice;
    if (filters.maxPrice !== undefined) priceRange.lte = filters.maxPrice;

    // Match against the effective price customers actually pay: the discount
    // price when one is set, otherwise the list price.
    // This is an AND condition with everything else, so we add it separately
    where.AND = [
      {
        OR: [
          { discountPrice: { not: null, ...priceRange } },
          { discountPrice: null, price: priceRange },
        ],
      },
    ];
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
