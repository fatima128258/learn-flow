import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  userOrganization: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
  },
  course: {
    findFirst: vi.fn(),
  },
  enrollment: {
    findUnique: vi.fn(),
  },
  courseProgress: {
    findUnique: vi.fn(),
  },
  certificate: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('../services/authService', () => ({
  getSessionFromToken: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock('../prisma', () => ({
  default: () => prismaMock,
}));

vi.mock('../storage', async (importOriginal) => {
  const original = await importOriginal<typeof import('../storage')>();
  return {
    ...original,
    putObject: vi.fn().mockResolvedValue({
      key: 'orgs/org-a/certificates/cert-1/certificate.pdf',
      publicUrl:
        'http://localhost:9000/learnflow/orgs/org-a/certificates/cert-1/certificate.pdf',
    }),
    getPresignedUrl: vi.fn().mockResolvedValue('http://localhost:9000/signed/certificate.pdf'),
    deleteObjects: vi.fn().mockResolvedValue(undefined),
  };
});

import app from '../server';
import * as authService from '../services/authService';

const now = new Date('2026-08-28T12:00:00.000Z');

function membershipRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mem-1',
    userId: 'user-1',
    organizationId: 'org-a',
    role: 'STUDENT',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function courseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    organizationId: 'org-a',
    instructorUserId: 'instructor-1',
    title: 'Certificate Course',
    slug: 'certificate-course',
    description: null,
    thumbnailUrl: null,
    category: null,
    price: null,
    discountPrice: null,
    status: 'PUBLISHED',
    publishedAt: now,
    estimatedMinutes: null,
    difficulty: null,
    learningObjectives: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function enrollmentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'enrollment-1',
    userId: 'user-1',
    courseId: 'course-1',
    organizationId: 'org-a',
    status: 'ACTIVE',
    enrolledAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function completedCourseProgress(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cp-1',
    userId: 'user-1',
    courseId: 'course-1',
    organizationId: 'org-a',
    lastVisitedModuleId: 'module-2',
    lastVisitedLessonId: 'lesson-4',
    lastVisitedAt: now,
    completed: true,
    completedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function certificateRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cert-1',
    certificateId: 'CRT-ABC123',
    verificationToken: 'verify-token-123',
    userId: 'user-1',
    courseId: 'course-1',
    organizationId: 'org-a',
    organizationName: 'Acme Org',
    instructorUserId: 'instructor-1',
    instructorName: 'Instructor One',
    studentName: 'Student User',
    courseTitle: 'Certificate Course',
    completionDate: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function authenticateAs(
  role: 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'INSTRUCTOR' | 'STUDENT',
  options?: {
    userId?: string;
    organizationId?: string;
    emailVerified?: boolean;
  },
) {
  const userId = options?.userId ?? 'user-1';
  const organizationId = options?.organizationId ?? 'org-a';
  const emailVerified = options?.emailVerified ?? true;

  vi.mocked(authService.getSessionFromToken).mockResolvedValue({
    id: 'session-1',
    userId,
    tokenHash: 'hash',
    expiresAt: new Date(Date.now() + 3600000),
    revoked: false,
    createdAt: now,
    updatedAt: now,
  });

  vi.mocked(authService.getUserById).mockResolvedValue({
    id: userId,
    name: 'Student User',
    email: `${role.toLowerCase()}@example.com`,
    passwordHash: 'hash',
    emailVerified,
    createdAt: now,
    updatedAt: now,
  });

  prismaMock.userOrganization.findMany.mockResolvedValue([
    { role, organizationId, userId },
  ]);

  prismaMock.userOrganization.findFirst.mockImplementation(async ({ where }: { where?: { role?: string; organizationId?: string; userId?: string; id?: string; courseId?: string; moduleId?: string; quizId?: string; status?: string } }) => {
    if (where?.role === 'PLATFORM_ADMIN') {
      return role === 'PLATFORM_ADMIN' ? { role, organizationId, userId } : null;
    }
    return null;
  });
}

function cookie() {
  return ['learnflow_session=valid-token'];
}

function resetMocks() {
  prismaMock.userOrganization.findMany.mockReset();
  prismaMock.userOrganization.findFirst.mockReset();
  prismaMock.userOrganization.findUnique.mockReset();
  prismaMock.organization.findUnique.mockReset();
  prismaMock.course.findFirst.mockReset();
  prismaMock.enrollment.findUnique.mockReset();
  prismaMock.courseProgress.findUnique.mockReset();
  prismaMock.certificate.findUnique.mockReset();
  prismaMock.certificate.findFirst.mockReset();
  prismaMock.certificate.findMany.mockReset();
  prismaMock.certificate.create.mockReset();
  prismaMock.certificate.update.mockReset();
  vi.mocked(authService.getSessionFromToken).mockReset();
  vi.mocked(authService.getUserById).mockReset();
}

function setupEligibleFixtures(overrides: { completed?: boolean; existing?: boolean } = {}) {
  prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
  prismaMock.course.findFirst.mockResolvedValue(courseRecord());
  prismaMock.enrollment.findUnique.mockResolvedValue(enrollmentRecord());
  prismaMock.courseProgress.findUnique.mockResolvedValue(
    completedCourseProgress({ completed: overrides.completed ?? true }),
  );
  prismaMock.certificate.findUnique.mockResolvedValue(
    overrides.existing ? certificateRecord() : null,
  );
  prismaMock.organization.findUnique.mockResolvedValue({
    id: 'org-a',
    name: 'Acme Org',
    slug: 'acme',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });
}

const GENERATE_PATH = '/api/v1/organizations/org-a/student/courses/course-1/certificate';

describe('POST /api/v1/organizations/:organizationId/student/courses/:courseId/certificate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).post(GENERATE_PATH);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('rejects students with unverified email with 403', async () => {
    await authenticateAs('STUDENT', { emailVerified: false });
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());

    const res = await request(app).post(GENERATE_PATH).set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
  });

  it('rejects non-student roles with 403', async () => {
    await authenticateAs('INSTRUCTOR');
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ role: 'INSTRUCTOR' }),
    );

    const res = await request(app).post(GENERATE_PATH).set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('returns 403 for cross-tenant organization access', async () => {
    await authenticateAs('STUDENT', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/organizations/org-b/student/courses/course-foreign/certificate')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
  });

  it('returns 403 when student is not enrolled in the course', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(courseRecord());
    prismaMock.enrollment.findUnique.mockResolvedValue(null);

    const res = await request(app).post(GENERATE_PATH).set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('STUDENT_NOT_ENROLLED');
  });

  it('returns 404 when course does not exist', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.course.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/organizations/org-a/student/courses/nonexistent/certificate')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('COURSE_NOT_FOUND');
  });

  it('returns 409 when the course is not completed', async () => {
    await authenticateAs('STUDENT');
    setupEligibleFixtures({ completed: false });

    const res = await request(app).post(GENERATE_PATH).set('Cookie', cookie());

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('COURSE_NOT_COMPLETED');
    expect(prismaMock.certificate.create).not.toHaveBeenCalled();
  });

  it('returns 409 when a certificate already exists for the student/course', async () => {
    await authenticateAs('STUDENT');
    setupEligibleFixtures({ completed: true, existing: true });

    const res = await request(app).post(GENERATE_PATH).set('Cookie', cookie());

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CERTIFICATE_EXISTS');
    expect(prismaMock.certificate.create).not.toHaveBeenCalled();
  });

  it('generates a certificate with all required fields for a completed course', async () => {
    await authenticateAs('STUDENT');
    setupEligibleFixtures({ completed: true });

    vi.mocked(authService.getUserById).mockResolvedValue({
      id: 'user-1',
      name: 'Student User',
      email: 'student@example.com',
      passwordHash: 'hash',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    prismaMock.certificate.create.mockResolvedValue(certificateRecord());
    prismaMock.certificate.update.mockResolvedValue(certificateRecord());

    const res = await request(app).post(GENERATE_PATH).set('Cookie', cookie());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.studentName).toBe('Student User');
    expect(data.courseTitle).toBe('Certificate Course');
    expect(data.organizationName).toBe('Acme Org');
    expect(data.instructorName).toBe('Instructor One');
    expect(data.completionDate).toBeTruthy();
    expect(data.certificateId).toBe('CRT-ABC123');
    expect(data.verificationUrl).toContain(
      `/api/v1/certificates/verify/${data.verificationToken}`,
    );
    expect(data.pdfUrl).toContain('certificate.pdf');
    expect(data.pdfDownloadUrl).toContain('/certificates/CRT-ABC123/download');
    expect(prismaMock.certificate.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.certificate.update).toHaveBeenCalledWith({
      where: { id: 'cert-1' },
      data: { pdfUrl: expect.stringContaining('certificate.pdf') },
    });
  });
});

describe('GET /api/v1/organizations/:organizationId/student/certificates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('lists the student certificates within the tenant', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.certificate.findMany.mockResolvedValue([
      certificateRecord(),
      certificateRecord({
        id: 'cert-2',
        certificateId: 'CRT-DEF456',
        verificationToken: 'verify-token-456',
        courseId: 'course-2',
        courseTitle: 'Another Course',
      }),
    ]);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/certificates')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(prismaMock.certificate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', organizationId: 'org-a' },
      }),
    );
  });
});

describe('GET /api/v1/organizations/:organizationId/student/certificates/:certificateId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('returns 404 when the certificate does not belong to the student', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.certificate.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/certificates/CRT-ABC123')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('CERTIFICATE_NOT_FOUND');
  });

  it('returns 404 when the certificate belongs to another organization (tenant isolation)', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.certificate.findFirst.mockResolvedValue(
      certificateRecord({ organizationId: 'org-b' }),
    );

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/certificates/CRT-ABC123')
      .set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('CERTIFICATE_NOT_FOUND');
  });

  it('returns the certificate for the student within the tenant', async () => {
    await authenticateAs('STUDENT');
    prismaMock.userOrganization.findUnique.mockResolvedValue(membershipRecord());
    prismaMock.certificate.findFirst.mockResolvedValue(certificateRecord());

    const res = await request(app)
      .get('/api/v1/organizations/org-a/student/certificates/CRT-ABC123')
      .set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.data.certificateId).toBe('CRT-ABC123');
    expect(res.body.data.courseTitle).toBe('Certificate Course');
  });
});

describe('GET /api/v1/certificates/verify/:verificationToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('verifies a certificate publicly without authentication', async () => {
    prismaMock.certificate.findUnique.mockResolvedValue(certificateRecord());

    const res = await request(app).get('/api/v1/certificates/verify/verify-token-123');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      certificateId: 'CRT-ABC123',
      studentName: 'Student User',
      courseTitle: 'Certificate Course',
      organizationName: 'Acme Org',
      instructorName: 'Instructor One',
    });
  });

  it('returns 404 for an unknown verification token', async () => {
    prismaMock.certificate.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/v1/certificates/verify/unknown-token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('CERTIFICATE_NOT_FOUND');
  });
});

describe('GET /api/v1/organizations/:organizationId/certificates/:certificateId/download', () => {
  const DOWNLOAD_PATH = '/api/v1/organizations/org-a/certificates/CRT-ABC123/download';

  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  async function setupRole(role: 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'INSTRUCTOR' | 'STUDENT') {
    await authenticateAs(role, { userId: role === 'STUDENT' ? 'user-1' : 'staff-1' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ role, userId: role === 'STUDENT' ? 'user-1' : 'staff-1' }),
    );
  }

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get(DOWNLOAD_PATH);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('redirects a student to the presigned URL of their own certificate', async () => {
    await setupRole('STUDENT');
    prismaMock.certificate.findFirst.mockResolvedValue(
      certificateRecord({ pdfUrl: 'http://localhost:9000/learnflow/orgs/org-a/certificates/cert-1/certificate.pdf' }),
    );

    const res = await request(app).get(DOWNLOAD_PATH).set('Cookie', cookie());

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:9000/signed/certificate.pdf');
  });

  it('allows org staff to download a certificate PDF', async () => {
    await setupRole('ORG_ADMIN');
    prismaMock.certificate.findFirst.mockResolvedValue(
      certificateRecord({ pdfUrl: 'http://localhost:9000/learnflow/orgs/org-a/certificates/cert-1/certificate.pdf' }),
    );

    const res = await request(app).get(DOWNLOAD_PATH).set('Cookie', cookie());

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:9000/signed/certificate.pdf');
  });

  it('forbids a student downloading another student certificate', async () => {
    await authenticateAs('STUDENT', { userId: 'other-student' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(
      membershipRecord({ role: 'STUDENT', userId: 'other-student' }),
    );
    prismaMock.certificate.findFirst.mockResolvedValue(
      certificateRecord({ pdfUrl: 'http://localhost:9000/learnflow/orgs/org-a/certificates/cert-1/certificate.pdf' }),
    );

    const res = await request(app).get(DOWNLOAD_PATH).set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('returns 403 for cross-tenant access', async () => {
    await authenticateAs('STUDENT', { organizationId: 'org-a' });
    prismaMock.userOrganization.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/organizations/org-b/certificates/CRT-ABC123/download')
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
  });

  it('returns 404 when the certificate does not exist', async () => {
    await setupRole('STUDENT');
    prismaMock.certificate.findFirst.mockResolvedValue(null);

    const res = await request(app).get(DOWNLOAD_PATH).set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('CERTIFICATE_NOT_FOUND');
  });

  it('returns 404 when the certificate has no stored PDF', async () => {
    await setupRole('STUDENT');
    prismaMock.certificate.findFirst.mockResolvedValue(certificateRecord({ pdfUrl: null }));

    const res = await request(app).get(DOWNLOAD_PATH).set('Cookie', cookie());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('CERTIFICATE_PDF_NOT_FOUND');
  });
});
