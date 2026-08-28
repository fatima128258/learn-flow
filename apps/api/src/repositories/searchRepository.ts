import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

export interface SearchFilters {
  query?: string;
  category?: string;
  difficulty?: string;
}

export async function searchPublishedCourses(organizationId: string, filters: SearchFilters) {
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
    where.category = filters.category;
  }

  if (filters.difficulty) {
    where.difficulty = filters.difficulty;
  }

  return prisma().course.findMany({
    where,
    include: {
      instructorUser: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { publishedAt: 'desc' },
  });
}
