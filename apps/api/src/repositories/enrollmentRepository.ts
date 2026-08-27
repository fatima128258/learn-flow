import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

export interface CreateEnrollmentData {
  userId: string;
  courseId: string;
  organizationId: string;
}

export async function createEnrollment(data: CreateEnrollmentData) {
  return prisma().enrollment.create({
    data: {
      userId: data.userId,
      courseId: data.courseId,
      organizationId: data.organizationId,
    },
  });
}

export async function findByUserAndCourse(userId: string, courseId: string) {
  return prisma().enrollment.findUnique({
    where: {
      userId_courseId: { userId, courseId },
    },
  });
}

export async function listByUser(userId: string) {
  return prisma().enrollment.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      courseId: true,
      organizationId: true,
      status: true,
      enrolledAt: true,
      createdAt: true,
      updatedAt: true,
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          thumbnailUrl: true,
          category: true,
          difficulty: true,
          status: true,
          organizationId: true,
        },
      },
    },
    orderBy: { enrolledAt: 'desc' },
  });
}

export async function listByOrganization(organizationId: string) {
  return prisma().enrollment.findMany({
    where: { organizationId },
    select: {
      id: true,
      userId: true,
      courseId: true,
      organizationId: true,
      status: true,
      enrolledAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { enrolledAt: 'desc' },
  });
}

export async function deleteEnrollment(userId: string, courseId: string) {
  return prisma().enrollment.delete({
    where: {
      userId_courseId: { userId, courseId },
    },
  });
}

export async function countByCourse(courseId: string) {
  return prisma().enrollment.count({
    where: { courseId },
  });
}
