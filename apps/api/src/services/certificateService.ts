import crypto from 'crypto';
import * as courseRepo from '../repositories/courseRepository';
import * as enrollmentRepo from '../repositories/enrollmentRepository';
import * as progressRepo from '../repositories/progressRepository';
import * as organizationRepo from '../repositories/organizationRepository';
import * as certificateRepo from '../repositories/certificateRepository';
import * as authService from './authService';
import { dispatchNotification } from './notificationDispatcher';
import * as certificatePdfService from './certificatePdfService';
import * as storage from '../storage';
import { record as recordAudit } from './auditLogService';
import { initializeServices } from './serviceInitializer';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';
const APP_BASE_URL = process.env.APP_URL ?? 'http://localhost:3000';

function generateCertificateId() {
  const random = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `CRT-${random}`;
}

function generateVerificationToken() {
  return crypto.randomBytes(16).toString('hex');
}

function verificationUrl(verificationToken: string) {
  return `${APP_BASE_URL}/verify/${verificationToken}`;
}

function certificatePdfDownloadUrl(organizationId: string, certificateId: string) {
  return `${API_BASE_URL}/api/v1/organizations/${organizationId}/certificates/${certificateId}/download`;
}

function isCertificateUniqueConflict(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as { code?: unknown; meta?: { target?: unknown } };
  return (
    candidate.code === 'P2002' &&
    Array.isArray(candidate.meta?.target) &&
    candidate.meta.target.includes('userId') &&
    candidate.meta.target.includes('courseId')
  );
}

interface CertificateRecord {
  id: string;
  certificateId: string;
  verificationToken: string;
  userId: string;
  courseId: string;
  courseTitle: string;
  organizationId: string;
  organizationName: string;
  instructorName: string;
  studentName: string;
  completionDate: Date;
  createdAt: Date;
  pdfUrl: string | null;
  totalMarks?: number | null;
  obtainedMarks?: number | null;
  percentage?: number | null;
  passed?: boolean | null;
}

function toCertificateDto(certificate: CertificateRecord) {
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
    pdfUrl: certificate.pdfUrl ?? null,
    totalMarks: certificate.totalMarks ?? null,
    obtainedMarks: certificate.obtainedMarks ?? null,
    percentage: certificate.percentage ?? null,
    passed: certificate.passed ?? null,
    pdfDownloadUrl: certificate.pdfUrl
      ? certificatePdfDownloadUrl(certificate.organizationId, certificate.certificateId)
      : null,
  };
}

async function verifyStudentEligibility(organizationId: string, userId: string, courseId: string) {
  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }

  const enrollment = await enrollmentRepo.findByUserAndCourse(userId, courseId);
  if (
    !enrollment ||
    enrollment.organizationId !== organizationId ||
    !['ACTIVE', 'COMPLETED'].includes(enrollment.status)
  ) {
    throw new Error('STUDENT_NOT_ENROLLED');
  }

  const courseProgress = await progressRepo.getCourseProgress(userId, courseId);
  if (!courseProgress || !courseProgress.completed) {
    throw new Error('COURSE_NOT_COMPLETED');
  }

  return { course, courseProgress };
}

async function getCourseAssessmentResult(userId: string, courseId: string) {
  if (typeof progressRepo.listAttemptsForCourse !== 'function') {
    return { totalMarks: null, obtainedMarks: null, percentage: null, passed: null };
  }

  const attempts = (await progressRepo.listAttemptsForCourse(userId, courseId)) ?? [];
  const latestAttemptByQuiz = new Map<string, (typeof attempts)[number]>();
  for (const attempt of attempts) {
    latestAttemptByQuiz.set(attempt.quizId, attempt);
  }

  if (latestAttemptByQuiz.size === 0) {
    return { totalMarks: null, obtainedMarks: null, percentage: null, passed: null };
  }

  let totalMarks = 0;
  let obtainedMarks = 0;
  for (const attempt of latestAttemptByQuiz.values()) {
    const quizTotal = (attempt.quiz?.questions ?? []).reduce(
      (sum: number, question: { marks: number }) => sum + question.marks,
      0,
    );
    totalMarks += quizTotal;
    obtainedMarks += attempt.score ?? 0;
  }

  return {
    totalMarks,
    obtainedMarks,
    percentage: totalMarks === 0 ? 0 : (obtainedMarks / totalMarks) * 100,
    passed: [...latestAttemptByQuiz.values()].every((attempt) => attempt.passed),
  };
}

async function withAssessment<T extends { userId: string; courseId: string }>(certificate: T) {
  const assessment = await getCourseAssessmentResult(certificate.userId, certificate.courseId);
  return { ...certificate, ...assessment };
}

export async function generateCertificate(organizationId: string, userId: string, courseId: string) {
  console.log('[CERTIFICATE] === CERTIFICATE GENERATION STARTED ===');
  console.log('[CERTIFICATE] Request params:', {
    organizationId,
    userId: userId ? '***' + userId.slice(-4) : 'undefined',
    courseId,
    timestamp: new Date().toISOString(),
  });

  try {
    // Pre-initialize critical services to prevent cold start 502 errors
    console.log('[CERTIFICATE] Step 0: Pre-initializing services...');
    try {
      await initializeServices();
      console.log('[CERTIFICATE] ✓ Services pre-initialized');
    } catch (initError) {
      console.warn('[CERTIFICATE] ⚠ Service initialization warning (continuing):', initError instanceof Error ? initError.message : String(initError));
      // Continue even if initialization has issues - we'll handle failures gracefully
    }

    console.log('[CERTIFICATE] Step 1: Verifying student eligibility...');
    const { course, courseProgress } = await verifyStudentEligibility(
      organizationId,
      userId,
      courseId,
    );
    console.log('[CERTIFICATE] ✓ Eligibility verified:', {
      courseTitle: course.title,
      completed: courseProgress.completed,
    });

    console.log('[CERTIFICATE] Step 2: Checking for existing certificate...');
    const existing = await certificateRepo.findByUserAndCourse(userId, courseId);
    if (existing) {
      console.log('[CERTIFICATE] ✗ Certificate already exists:', existing.certificateId);
      throw new Error('CERTIFICATE_EXISTS');
    }
    console.log('[CERTIFICATE] ✓ No existing certificate found');

    console.log('[CERTIFICATE] Step 3: Fetching user and organization data...');
    const [student, organization, instructor, assessment] = await Promise.all([
      authService.getUserById(userId),
      organizationRepo.findOrganizationById(organizationId),
      authService.getUserById(course.instructorUserId),
      getCourseAssessmentResult(userId, courseId),
    ]);
    console.log('[CERTIFICATE] ✓ Data fetched:', {
      studentName: student?.name,
      organizationName: organization?.name,
      instructorName: instructor?.name,
    });

    const issued = courseProgress.completedAt ?? new Date();

    console.log('[CERTIFICATE] Step 4: Creating certificate record...');
    let certificate;
    try {
      certificate = await certificateRepo.createCertificate({
        certificateId: generateCertificateId(),
        verificationToken: generateVerificationToken(),
        userId,
        courseId,
        organizationId,
        organizationName: organization?.name ?? 'Unknown Organization',
        instructorUserId: course.instructorUserId,
        instructorName: instructor?.name?.trim() || organization?.name || 'Organization Instructor',
        studentName: student?.name ?? student?.email ?? 'Student',
        courseTitle: course.title,
        completionDate: issued,
      });
    } catch (error) {
      if (isCertificateUniqueConflict(error)) {
        throw new Error('CERTIFICATE_EXISTS');
      }
      throw error;
    }
    const certificateRecord: CertificateRecord = {
      ...certificate,
      ...assessment,
    };
    console.log('[CERTIFICATE] ✓ Certificate record created:', certificateRecord.certificateId);

    console.log('[CERTIFICATE] Step 5: Recording audit log...');
    try {
      await recordAudit({
        action: 'CERTIFICATE_GENERATED',
        organizationId,
        actorUserId: userId,
        actorName: student?.name ?? null,
        actorRole: 'STUDENT',
        resourceType: 'CERTIFICATE',
        resourceId: certificateRecord.id,
        metadata: {
          certificateId: certificateRecord.certificateId,
          courseId,
          courseTitle: course.title,
        },
      });
      console.log('[CERTIFICATE] ✓ Audit log recorded');
    } catch (auditErr) {
      console.error('[CERTIFICATE] ✗ Audit logging error:', auditErr);
      // Continue even if audit fails
    }

    console.log('[CERTIFICATE] Step 6: Dispatching notification...');
    try {
      await dispatchNotification({
        type: 'CERTIFICATE_GENERATED',
        title: `Certificate for ${course.title}`,
        body: `Your certificate for ${course.title} has been generated.`,
        data: {
          certificateId: certificateRecord.certificateId,
          courseId,
          courseTitle: course.title,
          verificationUrl: verificationUrl(certificateRecord.verificationToken),
        },
        userId,
        organizationId,
        email: {
          courseTitle: course.title,
          certificateUrl: verificationUrl(certificate.verificationToken),
        },
      });
      console.log('[CERTIFICATE] ✓ Notification dispatched');
    } catch (notifErr) {
      console.error('[CERTIFICATE] ✗ Notification error (non-critical, continuing):', notifErr);
      // IMPORTANT: Continue even if notification fails - certificate is still valid
      // This prevents Redis/queue issues from blocking certificate generation
    }

    console.log('[CERTIFICATE] Step 7: Generating PDF...');
    const pdfUrl = await createCertificatePdf(certificateRecord, organizationId);
    if (pdfUrl) {
      certificateRecord.pdfUrl = pdfUrl;
      console.log('[CERTIFICATE] ✓ PDF generated and uploaded:', pdfUrl);
    } else {
      console.log('[CERTIFICATE] ⚠ PDF generation skipped or failed');
    }

    console.log('[CERTIFICATE] === CERTIFICATE GENERATION COMPLETED ===');
    return toCertificateDto(certificateRecord);
  } catch (error) {
    console.error('[CERTIFICATE] === CERTIFICATE GENERATION FAILED ===');
    console.error('[CERTIFICATE] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      organizationId,
      courseId,
    });
    throw error;
  }
}

async function createCertificatePdf(certificate: CertificateRecord, organizationId: string) {
  console.log('[CERTIFICATE-PDF] Starting PDF generation...');
  try {
    const pdfUrl = await certificatePdfService.uploadCertificatePdf(
      organizationId,
      certificate.id,
      {
        certificateId: certificate.certificateId,
        verificationUrl: verificationUrl(certificate.verificationToken),
        studentName: certificate.studentName,
        courseTitle: certificate.courseTitle,
        organizationName: certificate.organizationName,
        instructorName: certificate.instructorName,
        completionDate: certificate.completionDate,
        totalMarks: certificate.totalMarks,
        obtainedMarks: certificate.obtainedMarks,
        percentage: certificate.percentage,
        passed: certificate.passed,
      },
    );
    console.log('[CERTIFICATE-PDF] PDF uploaded successfully:', pdfUrl);
    
    await certificateRepo.updatePdfUrl(certificate.id, pdfUrl);
    console.log('[CERTIFICATE-PDF] PDF URL updated in database');
    
    return pdfUrl;
  } catch (error) {
    console.error('[CERTIFICATE-PDF] PDF generation/upload failed after retries:', error);
    // Best-effort: certificate still issued without a stored PDF file.
    return null;
  }
}

export async function listCertificates(organizationId: string, userId: string) {
  const records = await certificateRepo.listByUserAndOrganization(userId, organizationId);
  return Promise.all((records as CertificateRecord[]).map(async (record) =>
    toCertificateDto(await withAssessment(record)),
  ));
}

export async function getCertificate(organizationId: string, userId: string, certificateId: string) {
  const certificate = await certificateRepo.findByUserAndCertificateId(userId, certificateId);
  if (!certificate || certificate.organizationId !== organizationId) {
    throw new Error('CERTIFICATE_NOT_FOUND');
  }
  return toCertificateDto(await withAssessment(certificate as CertificateRecord));
}

export async function verifyCertificate(verificationToken: string) {
  const certificate = await certificateRepo.findByVerificationToken(verificationToken);
  if (!certificate) {
    throw new Error('CERTIFICATE_NOT_FOUND');
  }
  return toCertificateDto(await withAssessment(certificate as CertificateRecord));
}

const STAFF_ROLES = new Set(['ORG_ADMIN', 'INSTRUCTOR', 'PLATFORM_ADMIN']);

export async function getCertificateDownloadUrl(
  organizationId: string,
  userId: string,
  userRole: string | undefined,
  certificateId: string,
) {
  const certificate = await certificateRepo.findByOrganizationAndCertificateId(
    organizationId,
    certificateId,
  );
  if (!certificate) {
    throw new Error('CERTIFICATE_NOT_FOUND');
  }
  if (certificate.userId !== userId && !(userRole && STAFF_ROLES.has(userRole))) {
    throw new Error('FORBIDDEN');
  }
  if (!certificate.pdfUrl) {
    throw new Error('CERTIFICATE_PDF_NOT_FOUND');
  }

  const certificateWithAssessment = await withAssessment(certificate);
  const pdfUrl = await certificatePdfService.uploadCertificatePdf(
    organizationId,
    certificate.id,
    {
      certificateId: certificate.certificateId,
      verificationUrl: verificationUrl(certificate.verificationToken),
      studentName: certificate.studentName,
      courseTitle: certificate.courseTitle,
      organizationName: certificate.organizationName,
      instructorName: certificate.instructorName,
      completionDate: certificate.completionDate,
      totalMarks: certificateWithAssessment.totalMarks,
      obtainedMarks: certificateWithAssessment.obtainedMarks,
      percentage: certificateWithAssessment.percentage,
      passed: certificateWithAssessment.passed,
    },
  );
  const pdfKey = storage.certificatePdfKey(organizationId, certificate.id);
  await certificateRepo.updatePdfUrl(certificate.id, pdfUrl);
  return storage.getPresignedUrl(pdfKey, { expiresInSeconds: 900 });
}
