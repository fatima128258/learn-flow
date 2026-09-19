import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authRepo: {
    findUserById: vi.fn(),
    findUserByEmail: vi.fn(),
    updateUserEmail: vi.fn(),
    markUserEmailAsVerified: vi.fn(),
    deleteEmailVerificationTokensByUserId: vi.fn(),
    createEmailVerificationToken: vi.fn(),
    findUserPrimaryOrganization: vi.fn(),
  },
  email: {
    sendVerificationEmail: vi.fn(),
  },
  emailQueue: {
    isEmailQueueEnabled: vi.fn(() => false),
    getEmailQueue: vi.fn(),
  },
  audit: {
    record: vi.fn(),
  },
}));

vi.mock('../repositories/authRepository', () => mocks.authRepo);
vi.mock('../utils/email', () => ({
  sendVerificationEmail: mocks.email.sendVerificationEmail,
  sendPasswordResetEmail: vi.fn(),
  sendPasswordResetCodeEmail: vi.fn(),
}));
vi.mock('../queues/emailQueue', () => mocks.emailQueue);
vi.mock('../services/auditLogService', () => mocks.audit);
vi.mock('../repositories/organizationRepository', () => ({}));
vi.mock('../prisma', () => ({ default: vi.fn() }));
vi.mock('../utils/redis', () => ({ getRedis: vi.fn() }));
vi.mock('../services/notificationDispatcher', () => ({ dispatchNotification: vi.fn() }));

import { updateUserEmail } from '../services/authService';

const originalNodeEnv = process.env.NODE_ENV;
describe('updateUserEmail verification policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    mocks.authRepo.findUserById.mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'old@example.com',
      emailVerified: true,
      createdAt: new Date(),
    });
    mocks.authRepo.findUserByEmail.mockResolvedValue(null);
    mocks.authRepo.findUserPrimaryOrganization.mockResolvedValue(null);
    mocks.authRepo.updateUserEmail.mockResolvedValue(undefined);
    mocks.authRepo.markUserEmailAsVerified.mockResolvedValue(undefined);
    mocks.authRepo.deleteEmailVerificationTokensByUserId.mockResolvedValue(undefined);
    mocks.authRepo.createEmailVerificationToken.mockResolvedValue(undefined);
    mocks.audit.record.mockResolvedValue(undefined);
    mocks.email.sendVerificationEmail.mockResolvedValue(true);
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('updates and verifies the new email without sending verification', async () => {
    const result = await updateUserEmail({ userId: 'user-1', email: 'new@example.com' });

    expect(result.success).toBe(true);
    expect(mocks.authRepo.updateUserEmail).toHaveBeenCalledWith('user-1', 'new@example.com');
    expect(mocks.authRepo.markUserEmailAsVerified).toHaveBeenCalledWith('user-1');
    expect(mocks.authRepo.deleteEmailVerificationTokensByUserId).toHaveBeenCalledWith('user-1');
    expect(mocks.authRepo.createEmailVerificationToken).not.toHaveBeenCalled();
    expect(mocks.email.sendVerificationEmail).not.toHaveBeenCalled();
    expect(mocks.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'EMAIL_UPDATED' }));
  });

  it('does not send verification in production either', async () => {
    process.env.NODE_ENV = 'production';

    await updateUserEmail({ userId: 'user-1', email: 'new@example.com' });

    expect(mocks.authRepo.markUserEmailAsVerified).toHaveBeenCalledWith('user-1');
    expect(mocks.authRepo.createEmailVerificationToken).not.toHaveBeenCalled();
    expect(mocks.email.sendVerificationEmail).not.toHaveBeenCalled();
  });
});
