import * as enrollmentRepo from '../repositories/enrollmentRepository';
import * as courseRepo from '../repositories/courseRepository';
import * as moduleRepo from '../repositories/moduleRepository';
import * as lessonRepo from '../repositories/lessonRepository';
import getPrisma from '../prisma';

function toEnrolledCourseListItem(enrollment: any, course: any) {
  return {
    enrollmentId: enrollment.id,
    enrollmentStatus: enrollment.status,
    enrolledAt: enrollment.enrolledAt,
    courseId: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    category: course.category,
    difficulty: course.difficulty,
    estimatedMinutes: course.estimatedMinutes,
    learningObjectives: Array.isArray(course.learningObjectives) ? course.learningObjectives : [],
  };
}

function toCourseModuleDto(module: any, lessonCount: number) {
  return {
    id: module.id,
    title: module.title,
    description: module.description,
    order: module.order,
    lessonCount,
  };
}

function toModuleLessonDto(lesson: any) {
  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    type: lesson.type,
    duration: lesson.duration,
    order: lesson.order,
    isPreview: lesson.isPreview,
  };
}

function toLessonContentDto(lesson: any) {
  return {
    id: lesson.id,
    moduleId: lesson.moduleId,
    title: lesson.title,
    description: lesson.description,
    content: lesson.content,
    type: lesson.type,
    duration: lesson.duration,
    order: lesson.order,
    isPreview: lesson.isPreview,
  };
}

async function verifyEnrollment(userId: string, courseId: string, organizationId?: string) {
  const enrollment = await enrollmentRepo.findByUserAndCourse(userId, courseId);
  if (!enrollment) {
    throw new Error('STUDENT_NOT_ENROLLED');
  }
  if (organizationId && enrollment.organizationId !== organizationId) {
    throw new Error('STUDENT_NOT_ENROLLED');
  }
  return enrollment;
}

async function verifyCourseAccess(organizationId: string, userId: string, courseId: string) {
  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }
  await verifyEnrollment(userId, courseId, organizationId);
  return course;
}

async function verifyModuleInCourse(courseId: string, moduleId: string) {
  const module = await moduleRepo.getById(courseId, moduleId);
  if (!module) {
    throw new Error('MODULE_NOT_FOUND');
  }
  return module;
}

async function verifyLessonInModule(moduleId: string, lessonId: string) {
  const lesson = await lessonRepo.getById(moduleId, lessonId);
  if (!lesson) {
    throw new Error('LESSON_NOT_FOUND');
  }
  return lesson;
}

export async function listEnrolledCourses(organizationId: string, userId: string) {
  const enrollments = await enrollmentRepo.listByUser(userId);
  const orgEnrollments = enrollments.filter(
    (e: any) => e.organizationId === organizationId,
  );

  const courses = await Promise.all(
    orgEnrollments.map(async (enrollment: any) => {
      const course = await courseRepo.getById(organizationId, enrollment.courseId);
      return course ? toEnrolledCourseListItem(enrollment, course) : null;
    }),
  );

  return courses.filter(Boolean);
}

export async function getEnrolledCourseDetail(organizationId: string, userId: string, courseId: string) {
  const enrollment = await enrollmentRepo.findByUserAndCourse(userId, courseId);
  if (!enrollment || enrollment.organizationId !== organizationId) {
    throw new Error('STUDENT_NOT_ENROLLED');
  }

  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }

  const modules = await moduleRepo.listByCourse(courseId);

  const prisma = getPrisma();
  const modulesWithCounts = await Promise.all(
    modules.map(async (module: any) => {
      const lessonCount = await prisma.lesson.count({ where: { moduleId: module.id } });
      return toCourseModuleDto(module, lessonCount);
    }),
  );

  return {
    enrollmentId: enrollment.id,
    enrollmentStatus: enrollment.status,
    enrolledAt: enrollment.enrolledAt,
    courseId: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    category: course.category,
    difficulty: course.difficulty,
    estimatedMinutes: course.estimatedMinutes,
    learningObjectives: Array.isArray(course.learningObjectives) ? course.learningObjectives : [],
    modules: modulesWithCounts,
  };
}

export async function listCourseModules(organizationId: string, userId: string, courseId: string) {
  const course = await verifyCourseAccess(organizationId, userId, courseId);
  const modules = await moduleRepo.listByCourse(courseId);

  const prisma = getPrisma();
  const modulesWithCounts = await Promise.all(
    modules.map(async (module: any) => {
      const lessonCount = await prisma.lesson.count({ where: { moduleId: module.id } });
      return toCourseModuleDto(module, lessonCount);
    }),
  );

  return {
    courseId: course.id,
    courseName: course.title,
    modules: modulesWithCounts,
  };
}

export async function listModuleLessons(
  organizationId: string,
  userId: string,
  courseId: string,
  moduleId: string,
) {
  await verifyEnrollment(userId, courseId, organizationId);

  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }

  const module = await moduleRepo.getById(courseId, moduleId);
  if (!module) {
    throw new Error('MODULE_NOT_FOUND');
  }

  const lessons = await lessonRepo.listByModule(moduleId);

  return {
    moduleId: module.id,
    moduleTitle: module.title,
    courseId: course.id,
    courseName: course.title,
    lessons: lessons.map(toModuleLessonDto),
  };
}

export async function getLessonContent(
  organizationId: string,
  userId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
) {
  await verifyEnrollment(userId, courseId, organizationId);

  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }

  const module = await moduleRepo.getById(courseId, moduleId);
  if (!module) {
    throw new Error('MODULE_NOT_FOUND');
  }

  const lesson = await lessonRepo.getById(moduleId, lessonId);
  if (!lesson) {
    throw new Error('LESSON_NOT_FOUND');
  }

  return {
    enrollmentVerified: true,
    lesson: toLessonContentDto(lesson),
    module: {
      id: module.id,
      title: module.title,
      order: module.order,
    },
    course: {
      id: course.id,
      title: course.title,
    },
  };
}
