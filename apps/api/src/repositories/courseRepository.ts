import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

const courseCategoryInclude = {
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} as const;

export interface CreateCourseData {
  organizationId: string;
  instructorUserId: string;
  title: string;
  slug: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  categoryId?: string | null;
  price?: number | null;
  discountPrice?: number | null;
  estimatedMinutes?: number | null;
  difficulty?: string | null;
  learningObjectives?: string[];
  status: 'DRAFT';
  publishedAt: null;
}

export async function createCourse(data: CreateCourseData) {
  return prisma().course.create({
    data: {
      organizationId: data.organizationId,
      instructorUserId: data.instructorUserId,
      title: data.title,
      slug: data.slug,
      description: data.description,
      thumbnailUrl: data.thumbnailUrl,
      categoryId: data.categoryId,
      price: data.price,
      discountPrice: data.discountPrice,
      status: data.status,
      publishedAt: data.publishedAt,
      estimatedMinutes: data.estimatedMinutes,
      difficulty: data.difficulty,
      learningObjectives: data.learningObjectives,
    },
    include: courseCategoryInclude,
  });
}

export interface ListCoursesOptions {
  skip?: number;
  take?: number;
  status?: string;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

export async function listByOrganization(organizationId: string, options: ListCoursesOptions = {}) {
  const where: any = { organizationId };
  if (options.status) {
    where.status = options.status;
  }
  return prisma().course.findMany({
    where,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      difficulty: true,
      createdAt: true,
    },
    orderBy: options.orderBy ?? { createdAt: 'desc' },
    skip: options.skip,
    take: options.take,
  });
}

export async function countByOrganization(organizationId: string, status?: string) {
  const where: any = { organizationId };
  if (status) {
    where.status = status;
  }
  return prisma().course.count({ where });
}

export async function getById(organizationId: string, courseId: string) {
  return prisma().course.findFirst({
    where: { id: courseId, organizationId },
    include: courseCategoryInclude,
  });
}

export async function updateCourseStatus(
  organizationId: string,
  courseId: string,
  data: { status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED'; publishedAt: Date | null },
) {
  const result = await prisma().course.updateMany({
    where: { id: courseId, organizationId },
    data: {
      status: data.status,
      publishedAt: data.publishedAt,
    },
  });
  if (result.count === 0) {
    return null;
  }
  return prisma().course.findFirst({
    where: { id: courseId, organizationId },
    include: courseCategoryInclude,
  });
}

export async function updateThumbnail(
  organizationId: string,
  courseId: string,
  thumbnailUrl: string,
) {
  const result = await prisma().course.updateMany({
    where: { id: courseId, organizationId },
    data: { thumbnailUrl },
  });
  if (result.count === 0) {
    return null;
  }
  return prisma().course.findFirst({
    where: { id: courseId, organizationId },
    include: courseCategoryInclude,
  });
}
