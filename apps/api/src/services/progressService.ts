import * as courseRepo from '../repositories/courseRepository';
import * as moduleRepo from '../repositories/moduleRepository';
import * as lessonRepo from '../repositories/lessonRepository';
import * as enrollmentRepo from '../repositories/enrollmentRepository';
import * as progressRepo from '../repositories/progressRepository';
import { dispatchNotification } from './notificationDispatcher';
import getPrisma from '../prisma';

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function round0(value: number) {
  return Math.round(value);
}

async function verifyLessonAccess(
  organizationId: string,
  userId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
) {
  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }

  const enrollment = await enrollmentRepo.findByUserAndCourse(userId, courseId);
  if (!enrollment || enrollment.organizationId !== organizationId) {
    throw new Error('STUDENT_NOT_ENROLLED');
  }

  const module = await moduleRepo.getById(courseId, moduleId);
  if (!module) {
    throw new Error('MODULE_NOT_FOUND');
  }

  const lesson = await lessonRepo.getById(moduleId, lessonId);
  if (!lesson) {
    throw new Error('LESSON_NOT_FOUND');
  }

  return { course, module, lesson, enrollment };
}

async function verifyCourseAccess(organizationId: string, userId: string, courseId: string) {
  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }

  const enrollment = await enrollmentRepo.findByUserAndCourse(userId, courseId);
  if (!enrollment || enrollment.organizationId !== organizationId) {
    throw new Error('STUDENT_NOT_ENROLLED');
  }

  return { course, enrollment };
}

async function computeCourseProgress(
  userId: string,
  courseId: string,
  organizationId: string,
  course: { id: string; title?: string },
  courseProgress: {
    lastVisitedModuleId: string | null;
    lastVisitedLessonId: string | null;
    lastVisitedAt: Date | null;
  } | null,
) {
  const [modules, completedRows, attempts] = await Promise.all([
    moduleRepo.listByCourse(courseId),
    progressRepo.listLessonProgressForCourse(userId, courseId),
    progressRepo.listAttemptsForCourse(userId, courseId),
  ]);

  const prisma = getPrisma();
  const completedLessonIds = new Set(completedRows.map((row: { lessonId: string }) => row.lessonId));

  const lessonsByModule = new Map<string, { id: string }[]>();
  let totalLessons = 0;
  for (const module of modules) {
    const lessons = await prisma.lesson.findMany({
      where: { moduleId: module.id },
      select: { id: true, title: true, order: true },
      orderBy: { order: 'asc' },
    });
    lessonsByModule.set(module.id, lessons);
    totalLessons += lessons.length;
  }

  let completedLessons = 0;
  const moduleProgress = modules.map((module: { id: string; title: string; order: number; description: string | null }, index: number) => {
    const lessons = lessonsByModule.get(module.id) ?? [];
    let moduleCompleted = 0;
    for (const lesson of lessons) {
      if (completedLessonIds.has(lesson.id)) moduleCompleted += 1;
    }
    completedLessons += moduleCompleted;
    const percentage =
      lessons.length > 0 ? round2((moduleCompleted / lessons.length) * 100) : 0;
    return {
      id: module.id,
      title: module.title,
      order: module.order,
      description: module.description,
      lessonCount: lessons.length,
      completedLessons: moduleCompleted,
      percentage: round0(percentage),
      complete: lessons.length > 0 && moduleCompleted === lessons.length,
      moduleIndex: index,
    };
  });

  const coursePercentage =
    totalLessons > 0 ? round2((completedLessons / totalLessons) * 100) : 0;
  const courseComplete = totalLessons > 0 && completedLessons === totalLessons;

  const attemptsByQuiz = new Map<string, { attempts: number; best: number | null; latest: number | null; passed: boolean }>();
  for (const attempt of attempts) {
    const entry = attemptsByQuiz.get(attempt.quizId);
    if (!entry) {
      attemptsByQuiz.set(attempt.quizId, {
        attempts: 1,
        best: attempt.percentage,
        latest: attempt.percentage,
        passed: attempt.passed,
      });
    } else {
      entry.attempts += 1;
      entry.latest = attempt.percentage;
      entry.best = entry.best == null ? attempt.percentage : Math.max(entry.best, attempt.percentage);
      if (entry.passed === false && attempt.passed) entry.passed = true;
    }
  }

  const quizSummary = attemptsByQuiz.size > 0
    ? Array.from(attemptsByQuiz.entries()).map(([quizId, stat]) => ({
        quizId,
        attempts: stat.attempts,
        bestPercentage: stat.best,
        latestPercentage: stat.latest,
        passed: stat.passed,
      }))
    : [];

  return {
    courseId: course.id,
    courseTitle: course.title,
    organizationId,
    totalLessons,
    completedLessons,
    coursePercentage: round0(coursePercentage),
    courseComplete,
    enrollmentStatus: 'ACTIVE',
    lastVisited: courseProgress
      ? {
          moduleId: courseProgress.lastVisitedModuleId,
          lessonId: courseProgress.lastVisitedLessonId,
          lastVisitedAt: courseProgress.lastVisitedAt,
        }
      : null,
    modules: moduleProgress,
    quizzes: quizSummary,
  };
}

export async function getCourseProgress(
  organizationId: string,
  userId: string,
  courseId: string,
) {
  const { course } = await verifyCourseAccess(organizationId, userId, courseId);
  const courseProgress = await progressRepo.getCourseProgress(userId, courseId);
  return computeCourseProgress(userId, courseId, organizationId, course, courseProgress);
}

export async function recordLessonProgress(
  organizationId: string,
  userId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  rawInput: unknown,
) {
  await verifyLessonAccess(organizationId, userId, courseId, moduleId, lessonId);

  let completed = true;
  if (rawInput !== undefined && rawInput !== null) {
    if (typeof rawInput !== 'object') {
      throw new Error('MISSING_FIELDS');
    }
    if ((rawInput as Record<string, unknown>).completed !== undefined) {
      const val = (rawInput as Record<string, unknown>).completed;
      if (typeof val !== 'boolean') {
        throw new Error('MISSING_FIELDS');
      }
      completed = val;
    }
  }

  await progressRepo.upsertLessonProgress({
    userId,
    lessonId,
    moduleId,
    courseId,
    organizationId,
    completed,
  });

  await progressRepo.upsertCourseProgressLastVisited({
    userId,
    courseId,
    organizationId,
    moduleId,
    lessonId,
  });

  const course = await courseRepo.getById(organizationId, courseId);
  const courseProgress = await progressRepo.getCourseProgress(userId, courseId);

  const progress = await computeCourseProgress(
    userId,
    courseId,
    organizationId,
    course ?? { id: courseId },
    courseProgress,
  );

  if (courseProgress && progress.courseComplete !== courseProgress.completed) {
    await progressRepo.markCourseCompleted(userId, courseId, progress.courseComplete, organizationId);
  }

  if (progress.courseComplete && !(courseProgress && courseProgress.completed)) {
    await dispatchNotification({
      type: 'COURSE_COMPLETION',
      title: `Course completed: ${course?.title ?? 'Your course'}`,
      body: `Congratulations! You completed ${course?.title ?? 'your course'}.`,
      data: {
        courseId,
        courseTitle: course?.title ?? null,
      },
      userId,
      organizationId,
      email: { courseTitle: course?.title ?? null },
    });
  }

  return {
    lessonId,
    moduleId,
    courseId,
    completed,
    courseProgress: {
      coursePercentage: progress.coursePercentage,
      courseComplete: progress.courseComplete,
      completedLessons: progress.completedLessons,
      totalLessons: progress.totalLessons,
    },
  };
}
