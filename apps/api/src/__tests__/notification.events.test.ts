import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  dispatchMock,
  courseRepoMock,
  enrollmentRepoMock,
  orderRepoMock,
  paymentServiceMock,
  progressRepoMock,
  moduleRepoMock,
  lessonRepoMock,
  certificateRepoMock,
  organizationRepoMock,
  authServiceMock,
  prismaMock,
} = vi.hoisted(() => ({
  dispatchMock: { dispatchNotification: vi.fn() },
  courseRepoMock: { getById: vi.fn() },
  enrollmentRepoMock: { findByUserAndCourse: vi.fn(), createEnrollment: vi.fn() },
  orderRepoMock: { findPaidOrderForCourse: vi.fn(), createOrderWithPurchase: vi.fn() },
  paymentServiceMock: { processMockPayment: vi.fn() },
  progressRepoMock: {
    getCourseProgress: vi.fn(),
    upsertLessonProgress: vi.fn(),
    upsertCourseProgressLastVisited: vi.fn(),
    markCourseCompleted: vi.fn(),
    listLessonProgressForCourse: vi.fn(),
    listAttemptsForCourse: vi.fn(),
  },
  moduleRepoMock: { listByCourse: vi.fn(), getById: vi.fn() },
  lessonRepoMock: { getById: vi.fn() },
  certificateRepoMock: { findByUserAndCourse: vi.fn(), createCertificate: vi.fn() },
  organizationRepoMock: { findOrganizationById: vi.fn() },
  authServiceMock: { getUserById: vi.fn() },
  prismaMock: {
    lesson: { findMany: vi.fn() },
  },
}));

vi.mock('../services/notificationDispatcher', () => dispatchMock);
vi.mock('../repositories/courseRepository', () => courseRepoMock);
vi.mock('../repositories/enrollmentRepository', () => enrollmentRepoMock);
vi.mock('../repositories/orderRepository', () => orderRepoMock);
vi.mock('../services/paymentService', () => paymentServiceMock);
vi.mock('../repositories/progressRepository', () => progressRepoMock);
vi.mock('../repositories/moduleRepository', () => moduleRepoMock);
vi.mock('../repositories/lessonRepository', () => lessonRepoMock);
vi.mock('../repositories/certificateRepository', () => certificateRepoMock);
vi.mock('../repositories/organizationRepository', () => organizationRepoMock);
vi.mock('../services/authService', () => authServiceMock);
vi.mock('../prisma', () => ({ default: () => prismaMock }));

import * as enrollmentService from '../services/enrollmentService';
import * as commerceService from '../services/commerceService';
import * as progressService from '../services/progressService';
import * as certificateService from '../services/certificateService';

const now = new Date('2026-08-28T16:00:00.000Z');

function courseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    organizationId: 'org-a',
    instructorUserId: 'instructor-1',
    title: 'React Fundamentals',
    slug: 'react-fundamentals',
    description: 'Learn React',
    thumbnailUrl: null,
    category: 'Frontend',
    price: null,
    discountPrice: null,
    status: 'PUBLISHED',
    publishedAt: now,
    estimatedMinutes: 120,
    difficulty: 'BEGINNER',
    learningObjectives: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function resetMocks() {
  dispatchMock.dispatchNotification.mockReset();
  Object.values(courseRepoMock).forEach((fn) => (fn as any).mockReset());
  Object.values(enrollmentRepoMock).forEach((fn) => (fn as any).mockReset());
  Object.values(orderRepoMock).forEach((fn) => (fn as any).mockReset());
  Object.values(paymentServiceMock).forEach((fn) => (fn as any).mockReset());
  Object.values(progressRepoMock).forEach((fn) => (fn as any).mockReset());
  Object.values(moduleRepoMock).forEach((fn) => (fn as any).mockReset());
  Object.values(lessonRepoMock).forEach((fn) => (fn as any).mockReset());
  Object.values(certificateRepoMock).forEach((fn) => (fn as any).mockReset());
  Object.values(organizationRepoMock).forEach((fn) => (fn as any).mockReset());
  Object.values(authServiceMock).forEach((fn) => (fn as any).mockReset());
  prismaMock.lesson.findMany.mockReset();
}

describe('notification events wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
    dispatchMock.dispatchNotification.mockResolvedValue(true);
  });

  it('dispatches ENROLLMENT_CONFIRMATION when a student enrolls', async () => {
    courseRepoMock.getById.mockResolvedValue(courseRecord());
    enrollmentRepoMock.findByUserAndCourse.mockResolvedValue(null);
    enrollmentRepoMock.createEnrollment.mockResolvedValue({
      id: 'enroll-1',
      userId: 'user-1',
      courseId: 'course-1',
      organizationId: 'org-a',
      status: 'ACTIVE',
      enrolledAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await enrollmentService.enroll('org-a', 'user-1', 'course-1');

    expect(dispatchMock.dispatchNotification).toHaveBeenCalledTimes(1);
    expect(dispatchMock.dispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ENROLLMENT_CONFIRMATION',
        userId: 'user-1',
        organizationId: 'org-a',
      }),
    );
  });

  it('dispatches COURSE_PURCHASED after a successful purchase', async () => {
    courseRepoMock.getById.mockResolvedValue(courseRecord({ price: 100, discountPrice: 75 }));
    enrollmentRepoMock.findByUserAndCourse.mockResolvedValue(null);
    orderRepoMock.findPaidOrderForCourse.mockResolvedValue(null);
    paymentServiceMock.processMockPayment.mockResolvedValue({ success: true, providerRef: 'mock_ref' });
    orderRepoMock.createOrderWithPurchase.mockResolvedValue({
      order: { id: 'order-1' },
      enrollment: { id: 'enroll-1' },
    });

    await commerceService.purchaseCourse('org-a', 'user-1', 'course-1');

    expect(dispatchMock.dispatchNotification).toHaveBeenCalledTimes(1);
    expect(dispatchMock.dispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'COURSE_PURCHASED', userId: 'user-1', organizationId: 'org-a' }),
    );
  });

  it('dispatches COURSE_COMPLETION only when a course is newly completed', async () => {
    courseRepoMock.getById.mockResolvedValue(courseRecord());
    enrollmentRepoMock.findByUserAndCourse.mockResolvedValue({ id: 'enroll-1', organizationId: 'org-a' });
    moduleRepoMock.getById.mockResolvedValue({ id: 'mod-1', courseId: 'course-1' });
    lessonRepoMock.getById.mockResolvedValue({ id: 'lesson-1', moduleId: 'mod-1', order: 1 });
    progressRepoMock.upsertLessonProgress.mockResolvedValue({});
    progressRepoMock.upsertCourseProgressLastVisited.mockResolvedValue({});
    progressRepoMock.getCourseProgress.mockResolvedValue(null);
    moduleRepoMock.listByCourse.mockResolvedValue([{ id: 'mod-1', title: 'Module 1', description: null, order: 1 }]);
    prismaMock.lesson.findMany.mockResolvedValue([{ id: 'lesson-1', title: 'Lesson 1', order: 1 }]);
    progressRepoMock.listLessonProgressForCourse.mockResolvedValue([{ lessonId: 'lesson-1' }]);
    progressRepoMock.listAttemptsForCourse.mockResolvedValue([]);
    progressRepoMock.markCourseCompleted.mockResolvedValue({});

    await progressService.recordLessonProgress(
      'org-a',
      'user-1',
      'course-1',
      'mod-1',
      'lesson-1',
      { completed: true },
    );

    expect(progressRepoMock.markCourseCompleted).toHaveBeenCalledWith('user-1', 'course-1', true);
    expect(dispatchMock.dispatchNotification).toHaveBeenCalledTimes(1);
    expect(dispatchMock.dispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'COURSE_COMPLETION', userId: 'user-1', organizationId: 'org-a' }),
    );
  });

  it('does not dispatch COURSE_COMPLETION when the course was already completed', async () => {
    courseRepoMock.getById.mockResolvedValue(courseRecord());
    enrollmentRepoMock.findByUserAndCourse.mockResolvedValue({ id: 'enroll-1', organizationId: 'org-a' });
    moduleRepoMock.getById.mockResolvedValue({ id: 'mod-1', courseId: 'course-1' });
    lessonRepoMock.getById.mockResolvedValue({ id: 'lesson-1', moduleId: 'mod-1', order: 1 });
    progressRepoMock.upsertLessonProgress.mockResolvedValue({});
    progressRepoMock.upsertCourseProgressLastVisited.mockResolvedValue({});
    progressRepoMock.getCourseProgress.mockResolvedValue({ completed: true, completedAt: now });
    moduleRepoMock.listByCourse.mockResolvedValue([{ id: 'mod-1', title: 'Module 1', description: null, order: 1 }]);
    prismaMock.lesson.findMany.mockResolvedValue([{ id: 'lesson-1', title: 'Lesson 1', order: 1 }]);
    progressRepoMock.listLessonProgressForCourse.mockResolvedValue([{ lessonId: 'lesson-1' }]);
    progressRepoMock.listAttemptsForCourse.mockResolvedValue([]);

    await progressService.recordLessonProgress(
      'org-a',
      'user-1',
      'course-1',
      'mod-1',
      'lesson-1',
      { completed: true },
    );

    expect(dispatchMock.dispatchNotification).not.toHaveBeenCalled();
  });

  it('dispatches CERTIFICATE_GENERATED when a certificate is generated', async () => {
    courseRepoMock.getById.mockResolvedValue(courseRecord());
    enrollmentRepoMock.findByUserAndCourse.mockResolvedValue({ id: 'enroll-1', organizationId: 'org-a' });
    progressRepoMock.getCourseProgress.mockResolvedValue({
      completed: true,
      completedAt: now,
    });
    certificateRepoMock.findByUserAndCourse.mockResolvedValue(null);
    authServiceMock.getUserById
      .mockResolvedValueOnce({ id: 'user-1', email: 'student@example.com', name: 'Student' })
      .mockResolvedValueOnce({ id: 'instructor-1', email: 'instr@example.com', name: 'Instructor' });
    organizationRepoMock.findOrganizationById.mockResolvedValue({ id: 'org-a', name: 'Digitalsofts Academy' });
    certificateRepoMock.createCertificate.mockResolvedValue({
      id: 'cert-1',
      certificateId: 'CRT-ABC',
      verificationToken: 'token123',
      userId: 'user-1',
      courseId: 'course-1',
      organizationId: 'org-a',
      createdAt: now,
    });

    await certificateService.generateCertificate('org-a', 'user-1', 'course-1');

    expect(dispatchMock.dispatchNotification).toHaveBeenCalledTimes(1);
    expect(dispatchMock.dispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CERTIFICATE_GENERATED',
        userId: 'user-1',
        organizationId: 'org-a',
      }),
    );
  });
});
