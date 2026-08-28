import crypto from 'crypto';
import * as courseRepo from '../repositories/courseRepository';
import * as enrollmentRepo from '../repositories/enrollmentRepository';
import * as progressRepo from '../repositories/progressRepository';
import * as organizationRepo from '../repositories/organizationRepository';
import * as certificateRepo from '../repositories/certificateRepository';
import * as authService from './authService';
import { dispatchNotification } from './notificationDispatcher';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

function generateCertificateId() {
  const random = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `CRT-${random}`;
}

function generateVerificationToken() {
  return crypto.randomBytes(16).toString('hex');
}

function verificationUrl(verificationToken: string) {
  return `${API_BASE_URL}/api/v1/certificates/verify/${verificationToken}`;
}

function toCertificateDto(certificate: any) {
  return {
    certificateId: certificate.certificateId,
    verificationToken: certificate.verificationToken,
    verificationUrl: verificationUrl(certificate.verificationToken),
    courseId: certificate.courseId,
    courseTitle: certificate.courseTitle,
    organizationId: certificate.organizationId,
    organizationName: certificate.organizationName,
    instructorName: certificate.instructorName,
    studentName: certificate.studentName,
    completionDate: certificate.completionDate,
    issuedAt: certificate.createdAt,
  };
}

async function verifyStudentEligibility(organizationId: string, userId: string, courseId: string) {
  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }

  const enrollment = await enrollmentRepo.findByUserAndCourse(userId, courseId);
  if (!enrollment || enrollment.organizationId !== organizationId) {
    throw new Error('STUDENT_NOT_ENROLLED');
  }

  const courseProgress = await progressRepo.getCourseProgress(userId, courseId);
  if (!courseProgress || !courseProgress.completed) {
    throw new Error('COURSE_NOT_COMPLETED');
  }

  return { course, courseProgress };
}

export async function generateCertificate(organizationId: string, userId: string, courseId: string) {
  const { course, courseProgress } = await verifyStudentEligibility(
    organizationId,
    userId,
    courseId,
  );

  const existing = await certificateRepo.findByUserAndCourse(userId, courseId);
  if (existing) {
    throw new Error('CERTIFICATE_EXISTS');
  }

  const [student, organization, instructor] = await Promise.all([
    authService.getUserById(userId),
    organizationRepo.findOrganizationById(organizationId),
    authService.getUserById(course.instructorUserId),
  ]);

  const issued = courseProgress.completedAt ?? new Date();

  const certificate = await certificateRepo.createCertificate({
    certificateId: generateCertificateId(),
    verificationToken: generateVerificationToken(),
    userId,
    courseId,
    organizationId,
    organizationName: organization?.name ?? 'Unknown Organization',
    instructorUserId: course.instructorUserId,
    instructorName: instructor?.name ?? 'Unknown Instructor',
    studentName: student?.name ?? student?.email ?? 'Student',
    courseTitle: course.title,
    completionDate: issued,
  });

  await dispatchNotification({
    type: 'CERTIFICATE_GENERATED',
    title: `Certificate for ${course.title}`,
    body: `Your certificate for ${course.title} has been generated.`,
    data: {
      certificateId: certificate.certificateId,
      courseId,
      courseTitle: course.title,
      verificationUrl: verificationUrl(certificate.verificationToken),
    },
    userId,
    organizationId,
    email: {
      courseTitle: course.title,
      certificateUrl: verificationUrl(certificate.verificationToken),
    },
  });

  return toCertificateDto(certificate);
}

export async function listCertificates(organizationId: string, userId: string) {
  const records = await certificateRepo.listByUserAndOrganization(userId, organizationId);
  return records.map(toCertificateDto);
}

export async function getCertificate(organizationId: string, userId: string, certificateId: string) {
  const certificate = await certificateRepo.findByUserAndCertificateId(userId, certificateId);
  if (!certificate || certificate.organizationId !== organizationId) {
    throw new Error('CERTIFICATE_NOT_FOUND');
  }
  return toCertificateDto(certificate);
}

export async function verifyCertificate(verificationToken: string) {
  const certificate = await certificateRepo.findByVerificationToken(verificationToken);
  if (!certificate) {
    throw new Error('CERTIFICATE_NOT_FOUND');
  }
  return toCertificateDto(certificate);
}
