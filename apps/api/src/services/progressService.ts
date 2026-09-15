import * as courseRepo from '../repositories/courseRepository';
import * as moduleRepo from '../repositories/moduleRepository';
import * as lessonRepo from '../repositories/lessonRepository';
import * as enrollmentRepo from '../repositories/enrollmentRepository';
import * as progressRepo from '../repositories/progressRepository';
import { dispatchNotification } from './notificationDispatcher';
import getPrisma from '../prisma';
import { assertContentUnlocked } from './sequentialAccess';

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
  if (enrollment.status && enrollment.status !== 'ACTIVE') {
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
  try {
    await assertContentUnlocked(userId, courseId, moduleId, 'LESSON', lessonId);
  } catch (err) {
    // Courses created before content sequencing was introduced have no
    // sequence rows. Enrollment and lesson ownership still protect access.
    if (!(err instanceof Error) || err.message !== 'CONTENT_SEQUENCE_MISSING') {
      throw err;
    }
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
  if (enrollment.status && enrollment.status !== 'ACTIVE') {
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
    progressRepo.listLessonProgressForCourse(userId, courseId, organizationId),
    progressRepo.listAttemptsForCourse(userId, courseId),
  ]);

  const prisma = getPrisma();
  const completedLessonIds = new Set(completedRows.map((row: { lessonId: string }) => row.lessonId));
  const passedQuizIds = new Set(
    attempts.filter((attempt: { passed: boolean | null }) => attempt.passed === true)
      .map((attempt: { quizId: string }) => attempt.quizId),
  );
  const exhaustedAttemptsByQuiz = new Map<string, { count: number; maxAttempts: number | null }>();
  for (const attempt of attempts) {
    const current = exhaustedAttemptsByQuiz.get(attempt.quizId);
    exhaustedAttemptsByQuiz.set(attempt.quizId, {
      count: (current?.count ?? 0) + 1,
      maxAttempts: attempt.quiz?.maxAttempts ?? current?.maxAttempts ?? null,
    });
  }
  const exhaustedFailedQuizIds = new Set(
    Array.from(exhaustedAttemptsByQuiz.entries())
      .filter(([, state]) => state.maxAttempts !== null && state.count >= state.maxAttempts)
      .map(([quizId]) => quizId),
  );
  const completedQuizIds = new Set([...passedQuizIds, ...exhaustedFailedQuizIds]);

  // OPTIMIZATION: Batch query all lessons instead of N+1 loop
  const moduleIds = modules.map((m: { id: string }) => m.id);
  const allLessons = await prisma.lesson.findMany({
    where: { moduleId: { in: moduleIds } },
    select: { id: true, title: true, order: true, moduleId: true },
    orderBy: { order: 'asc' },
  });
  const allQuizzes = await prisma.quiz.findMany({
    where: { moduleId: { in: moduleIds } },
    select: { id: true, moduleId: true },
  });

  const lessonsByModule = new Map<string, { id: string }[]>();
  const contentItemsByModule = new Map<string, any[]>();
  if ((prisma as any).moduleContentItem?.findMany) {
    const items = await (prisma as any).moduleContentItem.findMany({
      where: { moduleId: { in: moduleIds } },
      select: { moduleId: true, type: true, lessonId: true, quizId: true },
    });
    for (const item of items) {
      const list = contentItemsByModule.get(item.moduleId) ?? [];
      list.push(item);
      contentItemsByModule.set(item.moduleId, list);
    }
  }
  let totalLessons = 0;
  let totalContentItems = 0;
  let completedContentItems = 0;
  for (const module of modules) {
    const lessons = allLessons.filter((l: { moduleId: string }) => l.moduleId === module.id);
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
    const contentItems = contentItemsByModule.get(module.id) ?? [];
    const quizzes = allQuizzes.filter((quiz: { moduleId: string }) => quiz.moduleId === module.id);
    const trackedItems = contentItems.length > 0
      ? contentItems
      : [
          ...lessons.map(lesson => ({ type: 'LESSON', lessonId: lesson.id })),
          ...quizzes.map(quiz => ({ type: 'QUIZ', quizId: quiz.id })),
        ];
    const completedItems = contentItems.length > 0
      ? trackedItems.filter((item) =>
        item.type === 'LESSON'
          ? completedLessonIds.has(item.lessonId ?? '')
          : completedQuizIds.has(item.quizId ?? ''),
      ).length
      : trackedItems.filter((item) =>
        item.type === 'LESSON'
          ? completedLessonIds.has(item.lessonId ?? '')
          : completedQuizIds.has(item.quizId ?? ''),
      ).length;
    const moduleDenominator = trackedItems.length;
    const percentage =
      moduleDenominator > 0 ? round2((completedItems / moduleDenominator) * 100) : 0;
    return {
      id: module.id,
      title: module.title,
      order: module.order,
      description: module.description,
      lessonCount: lessons.length,
      completedLessons: moduleCompleted,
      percentage: round0(percentage),
      complete: moduleDenominator > 0 && completedItems === moduleDenominator,
      moduleIndex: index,
      contentItemCount: contentItems.length,
      completedContentItems: completedItems,
    };
  });

  // ModuleContentItem is the persisted curriculum denominator. Keep the
  // lesson-only fallback for courses created before content sequencing.
  const items = Array.from(contentItemsByModule.values()).flat();
  if (items.length > 0) {
    totalContentItems = items.length;
    completedContentItems = items.filter((item: any) =>
      item.type === 'LESSON' ? completedLessonIds.has(item.lessonId) : completedQuizIds.has(item.quizId),
    ).length;
  } else {
    totalContentItems = totalLessons + allQuizzes.length;
    completedContentItems = completedLessons + allQuizzes.filter((quiz: { id: string }) => completedQuizIds.has(quiz.id)).length;
  }
  const denominator = totalContentItems > 0 ? totalContentItems : totalLessons;
  const numerator = totalContentItems > 0 ? completedContentItems : completedLessons;

  const coursePercentage =
    denominator > 0 ? round2((numerator / denominator) * 100) : 0;
  const courseComplete = denominator > 0 && numerator === denominator;

  const attemptsByQuiz = new Map<string, {
    attempts: number;
    best: number | null;
    latest: number | null;
    passed: boolean;
    maxAttempts: number | null;
  }>();
  for (const attempt of attempts) {
    const entry = attemptsByQuiz.get(attempt.quizId);
    if (!entry) {
      attemptsByQuiz.set(attempt.quizId, {
        attempts: 1,
        best: attempt.percentage ?? 0,
        latest: attempt.percentage ?? 0,
        passed: attempt.passed === true,
        maxAttempts: attempt.quiz?.maxAttempts ?? null,
      });
    } else {
      entry.attempts += 1;
      entry.latest = attempt.percentage ?? 0;
      entry.best = entry.best == null ? (attempt.percentage ?? 0) : Math.max(entry.best, attempt.percentage ?? 0);
      if (entry.passed === false && attempt.passed === true) entry.passed = true;
      if (entry.maxAttempts == null && attempt.quiz?.maxAttempts != null) {
        entry.maxAttempts = attempt.quiz.maxAttempts;
      }
    }
  }

  const quizSummary = attemptsByQuiz.size > 0
    ? Array.from(attemptsByQuiz.entries()).map(([quizId, stat]) => ({
        quizId,
        attempts: stat.attempts,
        bestPercentage: stat.best,
        latestPercentage: stat.latest,
        passed: stat.passed,
        failed: !stat.passed,
        attemptsRemaining: stat.maxAttempts == null
          ? null
          : Math.max(0, stat.maxAttempts - stat.attempts),
      }))
    : [];
  const quizIds = new Set(
    (items.length > 0
      ? items.filter((item: any) => item.type === 'QUIZ' && item.quizId).map((item: any) => item.quizId as string)
      : allQuizzes.map((quiz: { id: string }) => quiz.id)),
  );
  const allQuizzesPassed = Array.from(quizIds).every(quizId => passedQuizIds.has(quizId));
  const successfulCompletion = courseComplete && allQuizzesPassed;

  return {
    courseId: course.id,
    courseTitle: course.title,
    organizationId,
    totalLessons,
    completedLessons,
    totalContentItems: denominator,
    completedContentItems: numerator,
    coursePercentage: round0(coursePercentage),
    courseComplete,
    contentComplete: courseComplete,
    successfulCompletion,
    enrollmentStatus: 'ACTIVE',
    completedLessonIds: Array.from(completedLessonIds),
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
  const courseProgress = await progressRepo.getCourseProgress(userId, courseId, organizationId);
  return computeCourseProgress(userId, courseId, organizationId, course, courseProgress);
}

export async function refreshCourseProgressAfterQuiz(
  organizationId: string,
  userId: string,
  courseId: string,
) {
  const db: any = getPrisma();
  if (!db.courseProgress?.upsert) return;
  const { course } = await verifyCourseAccess(organizationId, userId, courseId);
  const current = await progressRepo.getCourseProgress(userId, courseId, organizationId);
  const progress = await computeCourseProgress(userId, courseId, organizationId, course, current);
  if (progress.courseComplete !== (current?.completed ?? false)) {
    await progressRepo.markCourseCompleted(userId, courseId, progress.courseComplete, organizationId);
  }
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
  const courseProgress = await progressRepo.getCourseProgress(userId, courseId, organizationId);

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
    void dispatchNotification({
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
      successfulCompletion: progress.successfulCompletion,
      completedLessons: progress.completedLessons,
      totalLessons: progress.totalLessons,
    },
  };
}
