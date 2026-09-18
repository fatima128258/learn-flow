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
const originalVerificationFlag = process.env.AUTH_EMAIL_CHANGE_REQUIRES_VERIFICATION;

describe('updateUserEmail verification policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    delete process.env.AUTH_EMAIL_CHANGE_REQUIRES_VERIFICATION;
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
    if (originalVerificationFlag === undefined) delete process.env.AUTH_EMAIL_CHANGE_REQUIRES_VERIFICATION;
    else process.env.AUTH_EMAIL_CHANGE_REQUIRES_VERIFICATION = originalVerificationFlag;
  });

  it('immediately activates the email when the flag is false', async () => {
    process.env.AUTH_EMAIL_CHANGE_REQUIRES_VERIFICATION = 'false';

    const result = await updateUserEmail({ userId: 'user-1', email: 'new@example.com' });

    expect(result.success).toBe(true);
    expect(mocks.authRepo.updateUserEmail).toHaveBeenCalledWith('user-1', 'new@example.com');
    expect(mocks.authRepo.markUserEmailAsVerified).toHaveBeenCalledWith('user-1');
    expect(mocks.authRepo.deleteEmailVerificationTokensByUserId).toHaveBeenCalledWith('user-1');
    expect(mocks.authRepo.createEmailVerificationToken).not.toHaveBeenCalled();
    expect(mocks.email.sendVerificationEmail).not.toHaveBeenCalled();
    expect(mocks.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'EMAIL_UPDATED' }));
  });

  it('keeps verification enabled when the flag is true', async () => {
    process.env.AUTH_EMAIL_CHANGE_REQUIRES_VERIFICATION = 'true';

    await updateUserEmail({ userId: 'user-1', email: 'new@example.com' });

    expect(mocks.authRepo.markUserEmailAsVerified).not.toHaveBeenCalled();
    expect(mocks.authRepo.createEmailVerificationToken).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      tokenHash: expect.any(String),
      expiresAt: expect.any(Date),
    }));
    expect(mocks.email.sendVerificationEmail).toHaveBeenCalledWith('new@example.com', expect.any(String));
  });

  it('uses secure verification behavior when the flag is missing', async () => {
    await updateUserEmail({ userId: 'user-1', email: 'new@example.com' });

    expect(mocks.authRepo.markUserEmailAsVerified).not.toHaveBeenCalled();
    expect(mocks.authRepo.createEmailVerificationToken).toHaveBeenCalledTimes(1);
    expect(mocks.email.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it('enforces verification in production even when the flag is false', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_EMAIL_CHANGE_REQUIRES_VERIFICATION = 'false';

    await updateUserEmail({ userId: 'user-1', email: 'new@example.com' });

    expect(mocks.authRepo.markUserEmailAsVerified).not.toHaveBeenCalled();
    expect(mocks.authRepo.createEmailVerificationToken).toHaveBeenCalledTimes(1);
    expect(mocks.email.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });
});
