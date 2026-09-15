import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authRepo: {
    findUserByEmail: vi.fn(),
    findPasswordResetTokensByUserId: vi.fn(),
    createPasswordResetToken: vi.fn(),
    updatePasswordResetToken: vi.fn(),
    deletePasswordResetTokenById: vi.fn(),
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
    sendPasswordResetCodeEmail: vi.fn(),
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

import { registerUser, requestPasswordReset, verifyPasswordResetCode } from '../services/authService';
import { hashToken } from '../utils/tokens';

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
    mocks.email.sendPasswordResetCodeEmail.mockResolvedValue(true);
    mocks.authRepo.findPasswordResetTokensByUserId.mockResolvedValue([]);
    mocks.authRepo.createPasswordResetToken.mockResolvedValue({ id: 'reset-1' });
    mocks.authRepo.updatePasswordResetToken.mockResolvedValue({ id: 'reset-1' });
    mocks.authRepo.deletePasswordResetTokenById.mockResolvedValue({ id: 'reset-1' });
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

  it('awaits the password reset code email before reporting success', async () => {
    mocks.authRepo.findUserByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'student@example.com',
    });

    await requestPasswordReset({ email: ' Student@Example.com ', ip: '127.0.0.1' });

    expect(mocks.email.sendPasswordResetCodeEmail).toHaveBeenCalledTimes(1);
    expect(mocks.email.sendPasswordResetCodeEmail).toHaveBeenCalledWith(
      'student@example.com',
      expect.stringMatching(/^\d{6}$/),
    );
    expect(mocks.authRepo.createPasswordResetToken).toHaveBeenCalledTimes(1);
  });

  it('removes the reset record and surfaces email delivery failures', async () => {
    mocks.authRepo.findUserByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'student@example.com',
    });
    mocks.email.sendPasswordResetCodeEmail.mockRejectedValue(new Error('EMAIL_DELIVERY_FAILED'));

    await expect(requestPasswordReset({ email: 'student@example.com', ip: '127.0.0.1' }))
      .rejects.toThrow('EMAIL_DELIVERY_FAILED');
    expect(mocks.authRepo.deletePasswordResetTokenById).toHaveBeenCalledWith('reset-1');
  });

  it('verifies an active reset code and invalidates the code after verification', async () => {
    const resetRecord: {
      id: string;
      codeHash: string | null;
      tokenHash: string;
      attempts: number;
      used: boolean;
      expiresAt: Date;
    } = {
      id: 'reset-1',
      codeHash: hashToken('123456'),
      tokenHash: 'old-token-hash',
      attempts: 0,
      used: false,
      expiresAt: new Date(Date.now() + 60_000),
    };
    mocks.authRepo.findUserByEmail.mockResolvedValue({ id: 'user-1', email: 'student@example.com' });
    mocks.authRepo.findPasswordResetTokensByUserId.mockResolvedValue([resetRecord]);
    await verifyPasswordResetCode({ email: 'student@example.com', code: '123456', ip: '127.0.0.1' });

    expect(mocks.authRepo.updatePasswordResetToken).toHaveBeenCalledWith('reset-1', expect.objectContaining({
      codeHash: null,
      verifiedAt: expect.any(Date),
    }));

    resetRecord.codeHash = null;
    await expect(verifyPasswordResetCode({
      email: 'student@example.com',
      code: '123456',
      ip: '127.0.0.1',
    })).rejects.toThrow('INVALID_CODE');
  });

  it('rejects expired reset codes and marks them unusable', async () => {
    mocks.authRepo.findUserByEmail.mockResolvedValue({ id: 'user-1', email: 'student@example.com' });
    mocks.authRepo.findPasswordResetTokensByUserId.mockResolvedValue([{
      id: 'reset-1',
      codeHash: 'code-hash',
      attempts: 0,
      used: false,
      expiresAt: new Date(Date.now() - 1_000),
    }]);

    await expect(verifyPasswordResetCode({
      email: 'student@example.com',
      code: '123456',
      ip: '127.0.0.1',
    })).rejects.toThrow('CODE_EXPIRED');
    expect(mocks.authRepo.updatePasswordResetToken).toHaveBeenCalledWith('reset-1', expect.objectContaining({
      used: true,
    }));
  });
});
