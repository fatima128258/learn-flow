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
    select: {
      id: true,
      organizationId: true,
      instructorUserId: true,
      title: true,
      slug: true,
      description: true,
      thumbnailUrl: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      price: true,
      discountPrice: true,
      status: true,
      publishedAt: true,
      estimatedMinutes: true,
      difficulty: true,
      learningObjectives: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export interface ListCoursesOptions {
  skip?: number;
  take?: number;
  status?: string;
  orderBy?: Record<string, 'asc' | 'desc'>;
  /** When set, restricts results to courses owned by this instructor. */
  instructorId?: string;
  categoryId?: string;
  includeDetails?: boolean;
}

export async function listByOrganization(organizationId: string, options: ListCoursesOptions = {}) {
  const where: Prisma.CourseWhereInput = { organizationId };
  if (options.status) {
    where.status = options.status as Prisma.CourseWhereInput['status'];
  }
  if (options.instructorId) {
    where.instructorUserId = options.instructorId;
  }
  if (options.categoryId) {
    where.categoryId = options.categoryId;
  }
  return prisma().course.findMany({
    where,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      difficulty: true,
      ...(options.includeDetails
        ? {
            price: true,
            discountPrice: true,
            instructorUser: {
              select: {
                id: true,
                name: true,
              },
            },
          }
        : {}),
      createdAt: true,
    },
    orderBy: options.orderBy ?? { createdAt: 'desc' },
    skip: options.skip,
    take: options.take,
  });
}

export async function countByOrganization(
  organizationId: string,
  status?: string,
  instructorId?: string,
  categoryId?: string,
) {
  const where: Prisma.CourseWhereInput = { organizationId };
  if (status) {
    where.status = status as Prisma.CourseWhereInput['status'];
  }
  if (instructorId) {
    where.instructorUserId = instructorId;
  }
  if (categoryId) {
    where.categoryId = categoryId;
  }
  return prisma().course.count({ where });
}

type DailyEnrollmentRow = { date: string; count: bigint };

/**
 * Dashboard data is scoped by both the course owner and organization. The
 * enrollment join repeats the organization predicate so malformed rows cannot
 * expose purchases from a different tenant.
 */
export async function getInstructorDashboard(
  organizationId: string,
  instructorUserId: string,
  start: Date,
  end: Date,
) {
  const courseWhere = { organizationId, instructorUserId };
  const [totalCourses, publishedCourses, draftCourses, enrollmentRows] = await Promise.all([
    prisma().course.count({ where: courseWhere }),
    prisma().course.count({ where: { ...courseWhere, status: 'PUBLISHED' } }),
    prisma().course.count({ where: { ...courseWhere, status: 'DRAFT' } }),
    prisma().$queryRaw<DailyEnrollmentRow[]>`
      SELECT TO_CHAR(DATE_TRUNC('day', e."enrolledAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
        COUNT(DISTINCT e."userId") AS count
      FROM "Enrollment" e
      INNER JOIN "Course" c ON c.id = e."courseId"
        AND c."organizationId" = ${organizationId}
        AND c."instructorUserId" = ${instructorUserId}
      WHERE e."organizationId" = ${organizationId}
        AND e."enrolledAt" >= ${start}
        AND e."enrolledAt" < ${end}
      GROUP BY DATE_TRUNC('day', e."enrolledAt" AT TIME ZONE 'UTC')
      ORDER BY DATE_TRUNC('day', e."enrolledAt" AT TIME ZONE 'UTC') ASC
    `,
  ]);

  return {
    totalCourses,
    publishedCourses,
    draftCourses,
    enrollmentTrend: enrollmentRows.map((row) => ({ date: row.date, count: Number(row.count) })),
  };
}

export async function getById(organizationId: string, courseId: string) {
  return prisma().course.findFirst({
    where: { id: courseId, organizationId },
    select: {
      id: true,
      organizationId: true,
      instructorUserId: true,
      title: true,
      slug: true,
      description: true,
      thumbnailUrl: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      price: true,
      discountPrice: true,
      status: true,
      publishedAt: true,
      estimatedMinutes: true,
      difficulty: true,
      learningObjectives: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function findBySlug(organizationId: string, slug: string) {
  return prisma().course.findFirst({
    where: { organizationId, slug },
    select: { id: true, slug: true },
  });
}

export async function getByIds(organizationId: string, courseIds: string[]) {
  return prisma().course.findMany({
    where: { id: { in: courseIds }, organizationId },
    select: {
      id: true,
      organizationId: true,
      instructorUserId: true,
      title: true,
      slug: true,
      description: true,
      thumbnailUrl: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      price: true,
      discountPrice: true,
      status: true,
      publishedAt: true,
      estimatedMinutes: true,
      difficulty: true,
      learningObjectives: true,
      createdAt: true,
      updatedAt: true,
    },
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
    select: {
      id: true,
      organizationId: true,
      instructorUserId: true,
      title: true,
      slug: true,
      description: true,
      thumbnailUrl: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      price: true,
      discountPrice: true,
      status: true,
      publishedAt: true,
      estimatedMinutes: true,
      difficulty: true,
      learningObjectives: true,
      createdAt: true,
      updatedAt: true,
    },
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
    select: {
      id: true,
      organizationId: true,
      instructorUserId: true,
      title: true,
      slug: true,
      description: true,
      thumbnailUrl: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      price: true,
      discountPrice: true,
      status: true,
      publishedAt: true,
      estimatedMinutes: true,
      difficulty: true,
      learningObjectives: true,
      createdAt: true,
      updatedAt: true,
    },
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
    select: {
      id: true,
      organizationId: true,
      instructorUserId: true,
      title: true,
      slug: true,
      description: true,
      thumbnailUrl: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      price: true,
      discountPrice: true,
      status: true,
      publishedAt: true,
      estimatedMinutes: true,
      difficulty: true,
      learningObjectives: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
