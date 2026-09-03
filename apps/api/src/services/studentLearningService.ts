import * as enrollmentRepo from '../repositories/enrollmentRepository';
import * as courseRepo from '../repositories/courseRepository';
import * as moduleRepo from '../repositories/moduleRepository';
import * as lessonRepo from '../repositories/lessonRepository';
import * as searchRepo from '../repositories/searchRepository';
import * as certificateRepo from '../repositories/certificateRepository';
import { categoryLabel } from '../utils/categoryLabel';
import getPrisma from '../prisma';

interface EnrolledEnrollment {
  id: string;
  status: string;
  enrolledAt: Date;
  organizationId: string;
  courseId: string;
}

interface EnrolledCourseRecord {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  category: unknown;
  difficulty: string | null;
  estimatedMinutes: number | null;
  learningObjectives: string[];
}

interface CourseModuleRecord {
  id: string;
  title: string;
  description: string | null;
  order: number;
}

interface ModuleLessonRecord {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  duration: number | null;
  order: number;
  isPreview: boolean;
}

interface LessonContentRecord extends ModuleLessonRecord {
  moduleId: string;
  content: string | null;
}

function toEnrolledCourseListItem(enrollment: EnrolledEnrollment, course: EnrolledCourseRecord) {
  return {
    enrollmentId: enrollment.id,
    enrollmentStatus: enrollment.status,
    enrolledAt: enrollment.enrolledAt,
    courseId: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    category: categoryLabel(course.category),
    difficulty: course.difficulty,
    estimatedMinutes: course.estimatedMinutes,
    learningObjectives: Array.isArray(course.learningObjectives) ? course.learningObjectives : [],
  };
}

function toCourseModuleDto(module: CourseModuleRecord, lessonCount: number) {
  return {
    id: module.id,
    title: module.title,
    description: module.description,
    order: module.order,
    lessonCount,
  };
}

function toModuleLessonDto(lesson: ModuleLessonRecord) {
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

function toLessonContentDto(lesson: LessonContentRecord) {
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

export async function getCourseOverview(
  organizationId: string,
  userId: string,
  courseId: string,
) {
  const course = await searchRepo.getPublishedCourseById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }

  const prisma = getPrisma();
  const [moduleCount, lessonCount, quizCount, enrollment] = await Promise.all([
    prisma.module.count({ where: { courseId: course.id } }),
    prisma.lesson.count({ where: { module: { courseId: course.id } } }),
    prisma.quiz.count({ where: { module: { courseId: course.id } } }),
    enrollmentRepo.findByUserAndCourse(userId, courseId),
  ]);

  return {
    id: course.id,
    organizationId: course.organizationId,
    instructor: {
      id: course.instructorUser?.id ?? course.instructorUserId,
      name: course.instructorUser?.name ?? null,
    },
    title: course.title,
    slug: course.slug,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    category: categoryLabel(course.category),
    difficulty: course.difficulty,
    price: course.price,
    discountPrice: course.discountPrice,
    estimatedMinutes: course.estimatedMinutes,
    learningObjectives: Array.isArray(course.learningObjectives) ? course.learningObjectives : [],
    status: course.status,
    publishedAt: course.publishedAt,
    moduleCount,
    lessonCount,
    quizCount,
    isEnrolled: Boolean(enrollment) && enrollment?.organizationId === organizationId,
  };
}

export async function listEnrolledCourses(organizationId: string, userId: string) {
  const enrollments = await enrollmentRepo.listByUser(userId);
  const orgEnrollments = enrollments.filter(
    (e: { organizationId: string }) => e.organizationId === organizationId,
  );

  // OPTIMIZATION: Batch fetch all courses instead of N individual queries
  const courseIds = orgEnrollments.map((e: EnrolledEnrollment) => e.courseId);
  const courses = await courseRepo.getByIds(organizationId, courseIds);
  const courseMap = new Map(courses.map((c: EnrolledCourseRecord) => [c.id, c]));
  
  return orgEnrollments
    .map((enrollment: EnrolledEnrollment) => {
      const course = courseMap.get(enrollment.courseId);
      return course ? toEnrolledCourseListItem(enrollment, course) : null;
    })
    .filter(Boolean);
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
  
  // OPTIMIZATION: Batch count lessons per module instead of N individual queries
  const moduleIds = modules.map((m: CourseModuleRecord) => m.id);
  const lessonCounts = await prisma.lesson.groupBy({
    by: ['moduleId'],
    where: { moduleId: { in: moduleIds } },
    _count: { id: true },
  });
  
  const countMap = new Map(lessonCounts.map((row: any) => [row.moduleId, row._count.id]));
  const modulesWithCounts = modules.map((module: CourseModuleRecord) =>
    toCourseModuleDto(module, countMap.get(module.id) ?? 0),
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
    category: categoryLabel(course.category),
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
  
  // OPTIMIZATION: Batch count lessons per module instead of N individual queries
  const moduleIds = modules.map((m: CourseModuleRecord) => m.id);
  const lessonCounts = await prisma.lesson.groupBy({
    by: ['moduleId'],
    where: { moduleId: { in: moduleIds } },
    _count: { id: true },
  });
  
  const countMap = new Map(lessonCounts.map((row: any) => [row.moduleId, row._count.id]));
  const modulesWithCounts = modules.map((module: CourseModuleRecord) =>
    toCourseModuleDto(module, countMap.get(module.id) ?? 0),
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

export async function getStudentStats(organizationId: string, userId: string) {
  const prisma = getPrisma();

  // Total available courses (published)
  const availableCourses = await courseRepo.countByOrganization(organizationId, 'PUBLISHED');

  // Enrolled courses count
  const enrollments = await enrollmentRepo.listByUser(userId);
  const orgEnrollments = enrollments.filter(
    (e: { organizationId: string }) => e.organizationId === organizationId,
  );
  const enrolledCount = orgEnrollments.length;

  // Certificates earned
  const certificates = await certificateRepo.listByUserAndOrganization(userId, organizationId);
  const certificatesEarned = certificates.length;

  // Learning time and categories from enrolled courses
  const enrolledCourseIds = orgEnrollments.map((e: EnrolledEnrollment) => e.courseId);
  const courses = enrolledCourseIds.length
    ? await prisma.course.findMany({
        where: {
          id: { in: enrolledCourseIds },
          organizationId,
        },
        select: { id: true, category: true, estimatedMinutes: true },
      })
    : [];
  const totalEstimatedMinutes = courses.reduce<number>(
    (sum, c) => sum + (c.estimatedMinutes ?? 0),
    0,
  );

  // Categories explored (unique categories from enrolled courses)
  const categoryCount = new Set(
    orgEnrollments
      .map((e: EnrolledEnrollment) => {
        const course = courses.find((c: { id: string }) => c.id === e.courseId);
        return course?.category;
      })
      .filter(Boolean),
  ).size;

  // Completed courses count
  const completedCourses = orgEnrollments.filter(
    (e: EnrolledEnrollment) => e.status === 'COMPLETED',
  ).length;

  // In progress courses count
  const inProgressCourses = enrolledCount - completedCourses - certificatesEarned;

  return {
    availableCourses,
    enrolledCourses: enrolledCount,
    certificatesEarned,
    completedCourses,
    inProgressCourses,
    categoriesExplored: categoryCount,
    totalEstimatedMinutes,
    totalEstimatedHours: totalEstimatedMinutes > 0 ? Math.round(totalEstimatedMinutes / 60) : 0,
  };
}
