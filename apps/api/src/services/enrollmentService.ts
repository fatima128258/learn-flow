import * as enrollmentRepo from '../repositories/enrollmentRepository';
import * as courseRepo from '../repositories/courseRepository';

function toEnrollmentDto(enrollment: any) {
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

function toEnrollmentWithCourseDto(enrollment: any) {
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

  return toEnrollmentDto(enrollment);
}

export async function listEnrollments(organizationId: string, userId: string) {
  const enrollments = await enrollmentRepo.listByUser(userId);
  const orgEnrollments = enrollments.filter(
    (e: any) => e.organizationId === organizationId,
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
