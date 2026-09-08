import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authRepo: {
    findUserByEmail: vi.fn(),
    createUser: vi.fn(),
    createEmailVerificationToken: vi.fn(),
    createSession: vi.fn(),
  },
  organizationRepo: {
    findOrganizationBySlug: vi.fn(),
  },
  prisma: {
    userOrganization: {
      create: vi.fn(),
    },
  },
  redis: {
    incr: vi.fn(),
    expire: vi.fn(),
  },
  email: {
    sendVerificationEmail: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
  },
  emailQueue: {
    getEmailQueue: vi.fn(),
    isEmailQueueEnabled: vi.fn(() => false),
  },
}));

vi.mock('../repositories/authRepository', () => mocks.authRepo);
vi.mock('../repositories/organizationRepository', () => mocks.organizationRepo);
vi.mock('../prisma', () => ({ default: () => mocks.prisma }));
vi.mock('../utils/redis', () => ({ getRedis: () => mocks.redis }));
vi.mock('../utils/email', () => mocks.email);
vi.mock('../queues/emailQueue', () => mocks.emailQueue);
vi.mock('argon2', () => ({
  default: {
    argon2id: 2,
    hash: vi.fn().mockResolvedValue('password-hash'),
  },
}));

import { registerUser } from '../services/authService';

describe('registerUser email fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redis.incr.mockResolvedValue(1);
    mocks.redis.expire.mockResolvedValue(1);
    mocks.authRepo.findUserByEmail.mockResolvedValue(null);
    mocks.authRepo.createUser.mockResolvedValue({
      id: 'user-1',
      name: 'New Student',
      email: 'student@example.com',
      passwordHash: 'password-hash',
      emailVerified: false,
    });
    mocks.organizationRepo.findOrganizationBySlug.mockResolvedValue(null);
    mocks.authRepo.createEmailVerificationToken.mockResolvedValue({ id: 'verification-1' });
    mocks.authRepo.createSession.mockResolvedValue({ id: 'session-1' });
    mocks.email.sendVerificationEmail.mockResolvedValue(true);
  });

  it('sends a verification email when the email queue is disabled', async () => {
    const result = await registerUser({
      name: 'New Student',
      email: ' Student@Example.com ',
      password: 'Password123!',
      ip: '127.0.0.1',
    });

    expect(result.user.email).toBe('student@example.com');
    expect(mocks.email.sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(mocks.email.sendVerificationEmail).toHaveBeenCalledWith(
      'student@example.com',
      expect.any(String),
    );
    expect(mocks.email.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('falls back to a verification email when queueing fails', async () => {
    mocks.emailQueue.isEmailQueueEnabled.mockReturnValue(true);
    mocks.emailQueue.getEmailQueue.mockReturnValue({
      add: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
    });

    await registerUser({
      name: 'New Student',
      email: 'student@example.com',
      password: 'Password123!',
      ip: '127.0.0.1',
    });

    await vi.waitFor(() => {
      expect(mocks.email.sendVerificationEmail).toHaveBeenCalledTimes(1);
    });
    expect(mocks.email.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
