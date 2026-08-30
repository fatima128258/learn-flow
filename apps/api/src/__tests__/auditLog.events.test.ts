import { beforeEach, describe, expect, it, vi } from 'vitest';

const { recordMock, courseRepoMock, enrollmentRepoMock, progressRepoMock, orgRepoMock, certRepoMock } =
  vi.hoisted(() => ({
    recordMock: {
      create: vi.fn(async () => ({ id: 'log-1' })),
      list: vi.fn(),
      count: vi.fn(),
    },
    courseRepoMock: {
      getById: vi.fn(),
      updateCourseStatus: vi.fn(),
    },
    enrollmentRepoMock: {
      findByUserAndCourse: vi.fn(),
      createEnrollment: vi.fn(),
      listByUser: vi.fn(async () => []),
      deleteEnrollment: vi.fn(),
    },
    progressRepoMock: {
      upsertLessonProgress: vi.fn(),
      listLessonProgressForCourse: vi.fn(async () => []),
      upsertCourseProgressLastVisited: vi.fn(),
      markCourseCompleted: vi.fn(),
      getCourseProgress: vi.fn(),
      getCourseProgressWithLesson: vi.fn(),
      listAttemptsForCourse: vi.fn(async () => []),
    },
    orgRepoMock: {
      findOrganizationById: vi.fn(),
      findOrganizationBySlug: vi.fn(),
      createOrganization: vi.fn(),
      updateOrganization: vi.fn(),
      listOrganizations: vi.fn(),
      getDashboardCounts: vi.fn(),
      findMembership: vi.fn(),
      upsertOrganizationAdmin: vi.fn(),
    },
    certRepoMock: {
      findByUserAndCourse: vi.fn(),
      createCertificate: vi.fn(),
      updatePdfUrl: vi.fn(),
      findByUserAndCertificateId: vi.fn(),
      findByVerificationToken: vi.fn(),
      findByOrganizationAndCertificateId: vi.fn(),
      listByUserAndOrganization: vi.fn(async () => []),
    },
  }));

vi.mock('../repositories/auditLogRepository', () => recordMock);

vi.mock('../services/authService', () => ({
  getUserById: vi.fn(),
}));

vi.mock('../services/notificationDispatcher', () => ({
  dispatchNotification: vi.fn(async () => true),
}));

vi.mock('../services/certificatePdfService', () => ({
  uploadCertificatePdf: vi.fn(async () => null),
}));

vi.mock('../repositories/courseRepository', () => courseRepoMock);

vi.mock('../repositories/enrollmentRepository', () => enrollmentRepoMock);

vi.mock('../repositories/progressRepository', () => progressRepoMock);

vi.mock('../repositories/organizationRepository', () => orgRepoMock);

vi.mock('../repositories/certificateRepository', () => certRepoMock);

import * as auditLogService from '../services/auditLogService';
import * as organizationService from '../services/organizationService';
import * as courseService from '../services/courseService';
import * as enrollmentService from '../services/enrollmentService';
import * as certificateService from '../services/certificateService';
import * as authService from '../services/authService';

const now = new Date('2026-08-28T16:00:00.000Z');

function courseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    organizationId: 'org-a',
    instructorUserId: 'instructor-1',
    title: 'React Fundamentals',
    slug: 'react-fundamentals',
    description: null,
    thumbnailUrl: null,
    category: 'Frontend',
    price: null,
    discountPrice: null,
    status: 'DRAFT',
    publishedAt: null,
    estimatedMinutes: 120,
    difficulty: 'BEGINNER',
    learningObjectives: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function enrollmentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'enrollment-1',
    userId: 'student-1',
    courseId: 'course-1',
    organizationId: 'org-a',
    status: 'ACTIVE',
    enrolledAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function certificateRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'certificate-repo-id',
    certificateId: 'CRT-ABC123',
    verificationToken: 'verify-token',
    userId: 'student-1',
    courseId: 'course-1',
    organizationId: 'org-a',
    organizationName: 'Academy A',
    instructorUserId: 'instructor-1',
    instructorName: 'Ira Instructor',
    studentName: 'Sam Student',
    courseTitle: 'React Fundamentals',
    completionDate: now,
    createdAt: now,
    updatedAt: now,
    pdfUrl: null,
    ...overrides,
  };
}

function userRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-a',
    name: 'Some User',
    email: 'some@example.com',
    emailVerified: true,
    passwordHash: 'hash',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function resetMocks() {
  recordMock.create.mockReset();
  recordMock.list.mockReset();
  recordMock.count.mockReset();
  Object.values(courseRepoMock).forEach((fn) => vi.mocked(fn).mockReset());
  Object.values(enrollmentRepoMock).forEach((fn) => vi.mocked(fn).mockReset());
  Object.values(progressRepoMock).forEach((fn) => vi.mocked(fn).mockReset());
  Object.values(orgRepoMock).forEach((fn) => vi.mocked(fn).mockReset());
  Object.values(certRepoMock).forEach((fn) => vi.mocked(fn).mockReset());
  vi.mocked(authService.getUserById).mockReset();
}

describe('audit log recording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
    recordMock.create.mockResolvedValue({ id: 'log-1' });
  });

  it('persists a normalized audit event', async () => {
    await auditLogService.record({
      action: 'LOGIN',
      actorUserId: 'user-1',
      actorEmail: 'user@example.com',
      resourceType: 'SESSION',
      resourceId: 'session-1',
      ipAddress: '127.0.0.1',
    });

    expect(recordMock.create).toHaveBeenCalledWith({
      organizationId: null,
      actorUserId: 'user-1',
      actorEmail: 'user@example.com',
      actorRole: null,
      action: 'LOGIN',
      resourceType: 'SESSION',
      resourceId: 'session-1',
      metadata: null,
      ipAddress: '127.0.0.1',
    });
  });

  it('never throws when the audit log repository fails', async () => {
    recordMock.create.mockRejectedValueOnce(new Error('db down'));

    await expect(
      auditLogService.record({ action: 'LOGIN', actorUserId: 'user-1' }),
    ).resolves.toBeNull();
  });
});

describe('audit event wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
    recordMock.create.mockResolvedValue({ id: 'log-1' });
  });

  it('records ORGANIZATION_CREATED with the platform admin actor', async () => {
    orgRepoMock.findOrganizationBySlug.mockResolvedValue(null);
    orgRepoMock.createOrganization.mockResolvedValue({
      id: 'org-a',
      name: 'Academy A',
      slug: 'academy-a',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      users: [],
    });

    await organizationService.createOrganization({
      name: 'Academy A',
      actor: { userId: 'platform-1', email: 'boss@example.com' },
    });

    expect(recordMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORGANIZATION_CREATED',
        organizationId: 'org-a',
        actorUserId: 'platform-1',
        actorEmail: 'boss@example.com',
        actorRole: 'PLATFORM_ADMIN',
        resourceType: 'ORGANIZATION',
        resourceId: 'org-a',
        metadata: { name: 'Academy A', slug: 'academy-a' },
      }),
    );
  });

  it('records COURSE_PUBLISHED when a course transitions to PUBLISHED', async () => {
    courseRepoMock.getById.mockResolvedValue(courseRecord({ status: 'DRAFT' }));
    courseRepoMock.updateCourseStatus.mockResolvedValue(
      courseRecord({ status: 'PUBLISHED', publishedAt: now }),
    );

    await courseService.updateCourseStatus(
      'org-a',
      'course-1',
      { status: 'PUBLISHED' },
      { userId: 'instructor-1', email: 'ira@example.com', role: 'INSTRUCTOR' },
    );

    expect(recordMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COURSE_PUBLISHED',
        organizationId: 'org-a',
        actorUserId: 'instructor-1',
        actorEmail: 'ira@example.com',
        actorRole: 'INSTRUCTOR',
        resourceType: 'COURSE',
        resourceId: 'course-1',
        metadata: expect.objectContaining({
          courseTitle: 'React Fundamentals',
          fromStatus: 'DRAFT',
          toStatus: 'PUBLISHED',
        }),
      }),
    );
  });

  it('does not record COURSE_PUBLISHED when the course is already published', async () => {
    courseRepoMock.getById.mockResolvedValue(courseRecord({ status: 'PUBLISHED', publishedAt: now }));
    courseRepoMock.updateCourseStatus.mockResolvedValue(
      courseRecord({ status: 'PUBLISHED', publishedAt: now }),
    );

    await courseService.updateCourseStatus(
      'org-a',
      'course-1',
      { status: 'PUBLISHED' },
      { userId: 'instructor-1' },
    );

    expect(recordMock.create).not.toHaveBeenCalled();
  });

  it('records ENROLLMENT_CREATED with the student actor', async () => {
    courseRepoMock.getById.mockResolvedValue(courseRecord({ status: 'PUBLISHED', publishedAt: now }));
    enrollmentRepoMock.findByUserAndCourse.mockResolvedValue(null);
    enrollmentRepoMock.createEnrollment.mockResolvedValue(enrollmentRecord());

    await enrollmentService.enroll('org-a', 'student-1', 'course-1');

    expect(recordMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ENROLLMENT_CREATED',
        organizationId: 'org-a',
        actorUserId: 'student-1',
        actorRole: 'STUDENT',
        resourceType: 'ENROLLMENT',
        resourceId: 'enrollment-1',
        metadata: { courseId: 'course-1', courseTitle: 'React Fundamentals' },
      }),
    );
  });

  it('records CERTIFICATE_GENERATED with the student actor', async () => {
    courseRepoMock.getById.mockResolvedValue(courseRecord({ status: 'PUBLISHED', publishedAt: now }));
    enrollmentRepoMock.findByUserAndCourse.mockResolvedValue(enrollmentRecord());
    progressRepoMock.getCourseProgress.mockResolvedValue({
      userId: 'student-1',
      courseId: 'course-1',
      organizationId: 'org-a',
      completed: true,
      completedAt: now,
    });
    certRepoMock.findByUserAndCourse.mockResolvedValue(null);
    orgRepoMock.findOrganizationById.mockResolvedValue({
      id: 'org-a',
      name: 'Academy A',
      slug: 'academy-a',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
    certRepoMock.createCertificate.mockResolvedValue(certificateRecord());
    vi.mocked(authService.getUserById).mockImplementation(async (id: string) =>
      id === 'student-1'
        ? userRecord({ id: 'student-1', name: 'Sam Student', email: 'sam@example.com' })
        : userRecord({ id: 'instructor-1', name: 'Ira Instructor', email: 'ira@example.com' }),
    );

    await certificateService.generateCertificate('org-a', 'student-1', 'course-1');

    expect(recordMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CERTIFICATE_GENERATED',
        organizationId: 'org-a',
        actorUserId: 'student-1',
        actorRole: 'STUDENT',
        resourceType: 'CERTIFICATE',
        resourceId: 'certificate-repo-id',
        metadata: expect.objectContaining({
          certificateId: 'CRT-ABC123',
          courseId: 'course-1',
          courseTitle: 'React Fundamentals',
        }),
      }),
    );
  });
});