import * as enrollmentRepo from '../repositories/enrollmentRepository';
import * as courseRepo from '../repositories/courseRepository';
import * as authService from './authService';
import { dispatchNotification } from './notificationDispatcher';
import { record as recordAudit } from './auditLogService';

interface EnrollmentRecord {
  id: string;
  userId: string;
  courseId: string;
  organizationId: string;
  status: string;
  enrolledAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface EnrollmentWithCourse extends EnrollmentRecord {
  course?: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    thumbnailUrl: string | null;
    category: unknown;
    difficulty: string | null;
    status: string;
    organizationId: string;
  };
}

function toEnrollmentDto(enrollment: EnrollmentRecord) {
  return {
    id: enrollment.id,
    userId: enrollment.userId,
    courseId: enrollment.courseId,
    organizationId: enrollment.organizationId,
    status: enrollment.status,
    enrolledAt: enrollment.enrolledAt,
    createdAt: enrollment.createdAt,
    updatedAt: enrollment.updatedAt,
  };
}

function toEnrollmentWithCourseDto(enrollment: EnrollmentWithCourse) {
  return {
    id: enrollment.id,
    userId: enrollment.userId,
    courseId: enrollment.courseId,
    organizationId: enrollment.organizationId,
    status: enrollment.status,
    enrolledAt: enrollment.enrolledAt,
    createdAt: enrollment.createdAt,
    updatedAt: enrollment.updatedAt,
    course: enrollment.course,
  };
}

export async function enroll(organizationId: string, userId: string, courseId: string) {
  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }

  if (course.status !== 'PUBLISHED') {
    throw new Error('COURSE_NOT_PUBLISHED');
  }

  const existing = await enrollmentRepo.findByUserAndCourse(userId, courseId);
  if (existing) {
    throw new Error('ALREADY_ENROLLED');
  }

  const enrollment = await enrollmentRepo.createEnrollment({
    userId,
    courseId,
    organizationId,
  });

  await recordAudit({
    action: 'ENROLLMENT_CREATED',
    organizationId,
    actorUserId: userId,
    actorName: (await authService.getUserById(userId))?.name ?? null,
    actorRole: 'STUDENT',
    resourceType: 'ENROLLMENT',
    resourceId: enrollment.id,
    metadata: { courseId: course.id, courseTitle: course.title },
  });

  await dispatchNotification({
    type: 'ENROLLMENT_CONFIRMATION',
    title: `Enrolled in ${course.title}`,
    body: `You have been enrolled in ${course.title}.`,
    data: {
      courseId: course.id,
      courseTitle: course.title,
      organizationName: organizationId,
    },
    userId,
    organizationId,
    email: { courseTitle: course.title },
  });

  return toEnrollmentDto(enrollment);
}

export async function listEnrollments(organizationId: string, userId: string) {
  const enrollments = await enrollmentRepo.listByUser(userId);
  const orgEnrollments = enrollments.filter(
    (e: { organizationId: string }) => e.organizationId === organizationId,
  );
  return orgEnrollments.map(toEnrollmentWithCourseDto);
}

export async function getEnrollment(organizationId: string, userId: string, courseId: string) {
  const enrollment = await enrollmentRepo.findByUserAndCourse(userId, courseId);
  if (!enrollment || enrollment.organizationId !== organizationId) {
    throw new Error('ENROLLMENT_NOT_FOUND');
  }
  return toEnrollmentDto(enrollment);
}

export async function unenroll(organizationId: string, userId: string, courseId: string) {
  const enrollment = await enrollmentRepo.findByUserAndCourse(userId, courseId);
  if (!enrollment || enrollment.organizationId !== organizationId) {
    throw new Error('ENROLLMENT_NOT_FOUND');
  }

  await enrollmentRepo.deleteEnrollment(userId, courseId);
  return { success: true };
}
