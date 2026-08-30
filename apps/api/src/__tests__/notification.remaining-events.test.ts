import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  dispatchMock,
  courseRepoMock,
  orgRepoMock,
  orgAdminRepoMock,
  authRepoMock,
} = vi.hoisted(() => ({
  dispatchMock: { dispatchNotification: vi.fn() },
  courseRepoMock: { getById: vi.fn(), updateCourseStatus: vi.fn() },
  orgRepoMock: { findOrganizationById: vi.fn() },
  orgAdminRepoMock: {
    findOrganizationMember: vi.fn(),
    createOrganizationMembership: vi.fn(),
  },
  authRepoMock: {
    findUserByEmail: vi.fn(),
    createUser: vi.fn(),
    findUserById: vi.fn(),
    markUserEmailAsVerified: vi.fn(),
    findPasswordResetTokenByTokenHash: vi.fn(),
    updateUserPassword: vi.fn(),
    markPasswordResetTokenAsUsed: vi.fn(),
    revokeAllSessionsByUserId: vi.fn(),
    findUserOrganizationsByUserId: vi.fn(),
  },
}));

vi.mock('../services/notificationDispatcher', () => dispatchMock);
vi.mock('../repositories/courseRepository', () => courseRepoMock);
vi.mock('../repositories/organizationRepository', () => orgRepoMock);
vi.mock('../repositories/orgAdminRepository', () => orgAdminRepoMock);
vi.mock('../repositories/authRepository', () => authRepoMock);
vi.mock('argon2', () => ({
  default: {
    hash: vi.fn(async () => 'hashed-password'),
    argon2id: 2,
  },
}));
vi.mock('../utils/redis', () => ({
  getRedis: () => ({
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
    del: vi.fn(async () => 1),
  }),
}));

import * as courseService from '../services/courseService';
import * as orgAdminService from '../services/orgAdminService';
import * as authService from '../services/authService';

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

function userRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    name: 'Sam Student',
    email: 'sam@example.com',
    emailVerified: true,
    passwordHash: 'hashed-password',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function resetMocks() {
  dispatchMock.dispatchNotification.mockReset();
  Object.values(courseRepoMock).forEach((fn) => vi.mocked(fn).mockReset());
  Object.values(orgRepoMock).forEach((fn) => vi.mocked(fn).mockReset());
  Object.values(orgAdminRepoMock).forEach((fn) => vi.mocked(fn).mockReset());
  Object.values(authRepoMock).forEach((fn) => vi.mocked(fn).mockReset());
}

describe('remaining notification event wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
    dispatchMock.dispatchNotification.mockResolvedValue(true);
  });

  describe('COURSE_PUBLISHED', () => {
    it('dispatches COURSE_PUBLISHED to the instructor when a course transitions to PUBLISHED', async () => {
      courseRepoMock.getById.mockResolvedValue(courseRecord());
      courseRepoMock.updateCourseStatus.mockResolvedValue(
        courseRecord({ status: 'PUBLISHED', publishedAt: now }),
      );

      const result = await courseService.updateCourseStatus('org-a', 'course-1', {
        status: 'PUBLISHED',
      });

      expect(result.status).toBe('PUBLISHED');
      expect(courseRepoMock.updateCourseStatus).toHaveBeenCalledWith(
        'org-a',
        'course-1',
        expect.objectContaining({ status: 'PUBLISHED', publishedAt: expect.any(Date) }),
      );
      expect(dispatchMock.dispatchNotification).toHaveBeenCalledTimes(1);
      expect(dispatchMock.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'COURSE_PUBLISHED',
          userId: 'instructor-1',
          organizationId: 'org-a',
        }),
      );
    });

    it('does not dispatch COURSE_PUBLISHED when the course is already published', async () => {
      courseRepoMock.getById.mockResolvedValue(
        courseRecord({ status: 'PUBLISHED', publishedAt: now }),
      );
      courseRepoMock.updateCourseStatus.mockResolvedValue(
        courseRecord({ status: 'PUBLISHED', publishedAt: now }),
      );

      await courseService.updateCourseStatus('org-a', 'course-1', { status: 'PUBLISHED' });

      expect(courseRepoMock.updateCourseStatus).toHaveBeenCalledTimes(1);
      expect(dispatchMock.dispatchNotification).not.toHaveBeenCalled();
    });

    it('rejects an unsupported status', async () => {
      courseRepoMock.getById.mockResolvedValue(courseRecord());
      courseRepoMock.updateCourseStatus.mockResolvedValue(null);

      await expect(
        courseService.updateCourseStatus('org-a', 'course-1', { status: 'BOGUS' }),
      ).rejects.toThrow('INVALID_STATUS');
      expect(courseRepoMock.updateCourseStatus).not.toHaveBeenCalled();
      expect(dispatchMock.dispatchNotification).not.toHaveBeenCalled();
    });
  });

  describe('WELCOME', () => {
    it('dispatches WELCOME when an org admin creates a brand new student', async () => {
      orgRepoMock.findOrganizationById.mockResolvedValue({ id: 'org-a', name: 'Academy A' });
      authRepoMock.findUserByEmail.mockResolvedValue(null);
      authRepoMock.createUser.mockResolvedValue(userRecord());
      authRepoMock.markUserEmailAsVerified.mockResolvedValue({});
      authRepoMock.findUserById.mockResolvedValue(userRecord());
      orgAdminRepoMock.findOrganizationMember.mockResolvedValue(null);
      orgAdminRepoMock.createOrganizationMembership.mockResolvedValue({
        id: 'mem-1',
        userId: 'user-1',
        organizationId: 'org-a',
        role: 'STUDENT',
        user: userRecord(),
      });

      await orgAdminService.createManagedUser('org-a', {
        name: 'Sam Student',
        email: 'sam@example.com',
        password: 'securepass123',
        requestedRole: 'STUDENT',
      });

      expect(dispatchMock.dispatchNotification).toHaveBeenCalledTimes(1);
      expect(dispatchMock.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'WELCOME',
          userId: 'user-1',
          organizationId: 'org-a',
        }),
      );
    });

    it('does not dispatch WELCOME when the user already exists in the system', async () => {
      orgRepoMock.findOrganizationById.mockResolvedValue({ id: 'org-a', name: 'Academy A' });
      authRepoMock.findUserByEmail.mockResolvedValue(userRecord());
      orgAdminRepoMock.findOrganizationMember.mockResolvedValue(null);
      orgAdminRepoMock.createOrganizationMembership.mockResolvedValue({
        id: 'mem-1',
        userId: 'user-1',
        organizationId: 'org-a',
        role: 'INSTRUCTOR',
        user: userRecord(),
      });

      await orgAdminService.createManagedUser('org-a', {
        email: 'sam@example.com',
        password: 'securepass123',
        requestedRole: 'INSTRUCTOR',
      });

      expect(dispatchMock.dispatchNotification).not.toHaveBeenCalled();
    });
  });

  describe('PASSWORD_RESET', () => {
    it('dispatches PASSWORD_RESET scoped to the user primary organization after a reset', async () => {
      authRepoMock.findPasswordResetTokenByTokenHash.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        used: false,
        expiresAt: new Date(Date.now() + 3600000),
      });
      authRepoMock.findUserById.mockResolvedValue(userRecord());
      authRepoMock.findUserOrganizationsByUserId.mockResolvedValue([
        { role: 'STUDENT', organizationId: 'org-a' },
      ]);
      authRepoMock.updateUserPassword.mockResolvedValue({});
      authRepoMock.markPasswordResetTokenAsUsed.mockResolvedValue({});
      authRepoMock.revokeAllSessionsByUserId.mockResolvedValue({});

      await authService.resetPassword('reset-token', 'newpass1234');

      expect(authRepoMock.findUserOrganizationsByUserId).toHaveBeenCalledWith('user-1');
      expect(dispatchMock.dispatchNotification).toHaveBeenCalledTimes(1);
      expect(dispatchMock.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PASSWORD_RESET',
          userId: 'user-1',
          organizationId: 'org-a',
        }),
      );
    });

    it('skips the notification when the user has no organization membership', async () => {
      authRepoMock.findPasswordResetTokenByTokenHash.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        used: false,
        expiresAt: new Date(Date.now() + 3600000),
      });
      authRepoMock.findUserById.mockResolvedValue(userRecord());
      authRepoMock.findUserOrganizationsByUserId.mockResolvedValue([]);
      authRepoMock.updateUserPassword.mockResolvedValue({});
      authRepoMock.markPasswordResetTokenAsUsed.mockResolvedValue({});
      authRepoMock.revokeAllSessionsByUserId.mockResolvedValue({});

      await authService.resetPassword('reset-token', 'newpass1234');

      expect(dispatchMock.dispatchNotification).not.toHaveBeenCalled();
    });
  });
});