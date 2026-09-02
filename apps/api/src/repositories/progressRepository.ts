import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

export interface UpsertLessonProgressData {
  userId: string;
  lessonId: string;
  moduleId: string;
  courseId: string;
  organizationId: string;
  completed: boolean;
}

export async function upsertLessonProgress(data: UpsertLessonProgressData) {
  const completedAt = data.completed ? new Date() : null;
  return prisma().lessonProgress.upsert({
    where: {
      userId_lessonId: {
        userId: data.userId,
        lessonId: data.lessonId,
      },
    },
    update: {
      completed: data.completed,
      completedAt,
    },
    create: {
      userId: data.userId,
      lessonId: data.lessonId,
      moduleId: data.moduleId,
      courseId: data.courseId,
      organizationId: data.organizationId,
      completed: data.completed,
      completedAt,
    },
  });
}

export async function listLessonProgressForCourse(userId: string, courseId: string) {
  return prisma().lessonProgress.findMany({
    where: { userId, courseId, completed: true },
    select: {
      lessonId: true,
      moduleId: true,
      completedAt: true,
    },
  });
}

export interface UpsertCourseProgressLastVisitedData {
  userId: string;
  courseId: string;
  organizationId: string;
  moduleId: string;
  lessonId: string;
}

export async function upsertCourseProgressLastVisited(data: UpsertCourseProgressLastVisitedData) {
  return prisma().courseProgress.upsert({
    where: {
      userId_courseId: {
        userId: data.userId,
        courseId: data.courseId,
      },
    },
    update: {
      organizationId: data.organizationId,
      lastVisitedModuleId: data.moduleId,
      lastVisitedLessonId: data.lessonId,
      lastVisitedAt: new Date(),
    },
    create: {
      userId: data.userId,
      courseId: data.courseId,
      organizationId: data.organizationId,
      lastVisitedModuleId: data.moduleId,
      lastVisitedLessonId: data.lessonId,
      lastVisitedAt: new Date(),
    },
  });
}

export async function markCourseCompleted(
  userId: string,
  courseId: string,
  completed: boolean,
  organizationId: string,
) {
  // organizationId is required — it must come from the authenticated request
  // context (enrollment record), never from client-supplied input. Storing an
  // empty string here would corrupt CourseProgress records and break any
  // subsequent query that filters on organizationId.
  if (!organizationId) {
    throw new Error('ORGANIZATION_REQUIRED');
  }
  return prisma().courseProgress.upsert({
    where: {
      userId_courseId: { userId, courseId },
    },
    update: {
      completed,
      completedAt: completed ? new Date() : null,
    },
    create: {
      userId,
      courseId,
      organizationId,
      completed,
      completedAt: completed ? new Date() : null,
    },
  });
}

export async function getCourseProgress(userId: string, courseId: string) {
  return prisma().courseProgress.findUnique({
    where: {
      userId_courseId: { userId, courseId },
    },
  });
}

export async function getCourseProgressWithLesson(userId: string, courseId: string, lessonId: string) {
  return prisma().courseProgress.findFirst({
    where: { userId, courseId, lastVisitedLessonId: lessonId },
  });
}

export async function listAttemptsForCourse(userId: string, courseId: string) {
  return prisma().quizAttempt.findMany({
    where: {
      userId,
      quiz: {
        module: {
          courseId,
        },
      },
    },
    select: {
      id: true,
      quizId: true,
      attemptNumber: true,
      score: true,
      percentage: true,
      passed: true,
      submittedAt: true,
      quiz: {
        select: {
          id: true,
          moduleId: true,
          title: true,
          passingPercentage: true,
        },
      },
    },
    orderBy: { submittedAt: 'asc' },
  });
}
