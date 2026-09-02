import getPrisma from '../prisma';
import { Prisma } from '@prisma/client';

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
  /** When set, restricts results to courses owned by this instructor. */
  instructorId?: string;
}

export async function listByOrganization(organizationId: string, options: ListCoursesOptions = {}) {
  const where: Prisma.CourseWhereInput = { organizationId };
  if (options.status) {
    where.status = options.status as Prisma.CourseWhereInput['status'];
  }
  if (options.instructorId) {
    where.instructorUserId = options.instructorId;
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

export async function countByOrganization(organizationId: string, status?: string, instructorId?: string) {
  const where: Prisma.CourseWhereInput = { organizationId };
  if (status) {
    where.status = status as Prisma.CourseWhereInput['status'];
  }
  if (instructorId) {
    where.instructorUserId = instructorId;
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

export interface UpdateCourseData {
  title?: string;
  slug?: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  categoryId?: string | null;
  price?: number | null;
  discountPrice?: number | null;
  estimatedMinutes?: number | null;
  difficulty?: string | null;
  learningObjectives?: string[];
  instructorUserId?: string;
}

export async function updateCourse(
  organizationId: string,
  courseId: string,
  data: UpdateCourseData,
) {
  const result = await prisma().course.updateMany({
    where: { id: courseId, organizationId },
    data: {
      title: data.title,
      slug: data.slug,
      description: data.description,
      thumbnailUrl: data.thumbnailUrl,
      categoryId: data.categoryId,
      price: data.price,
      discountPrice: data.discountPrice,
      estimatedMinutes: data.estimatedMinutes,
      difficulty: data.difficulty,
      learningObjectives: data.learningObjectives,
      instructorUserId: data.instructorUserId,
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
