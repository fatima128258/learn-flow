import { beforeEach, describe, expect, it, vi } from 'vitest';

const { recordMock, authRepoMock } = vi.hoisted(() => ({
  recordMock: {
    create: vi.fn(async () => ({ id: 'log-1' })),
    list: vi.fn(),
    count: vi.fn(),
  },
  authRepoMock: {
    findUserByEmail: vi.fn(),
    createSession: vi.fn(),
    findUserOrganizationsByUserId: vi.fn(),
  },
}));

vi.mock('argon2', () => ({
  default: {
    hash: vi.fn(async () => 'hashed-password'),
    verify: vi.fn(async () => true),
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

vi.mock('../repositories/authRepository', () => authRepoMock);

vi.mock('../repositories/auditLogRepository', () => recordMock);

vi.mock('../services/notificationDispatcher', () => ({
  dispatchNotification: vi.fn(async () => true),
}));

import * as authService from '../services/authService';

const now = new Date('2026-08-28T16:00:00.000Z');

function userRecord() {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'user@example.com',
    passwordHash: 'hashed-password',
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  };
}

describe('login audit recording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(authRepoMock).forEach((fn) => vi.mocked(fn).mockReset());
    recordMock.create.mockReset();
    recordMock.create.mockResolvedValue({ id: 'log-1' });
  });

  it('records a LOGIN event with primary organization after a successful login', async () => {
    authRepoMock.findUserByEmail.mockResolvedValue(userRecord());
    authRepoMock.createSession.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 3600000),
      revoked: false,
      createdAt: now,
      updatedAt: now,
    });
    authRepoMock.findUserOrganizationsByUserId.mockResolvedValue([
      { role: 'ORG_ADMIN', organizationId: 'org-a', userId: 'user-1' },
    ]);

    await authService.loginUser({
      email: 'user@example.com',
      password: 'correct-password',
      ip: '203.0.113.5',
    });

    expect(recordMock.create).toHaveBeenCalledWith({
      action: 'LOGIN',
      organizationId: 'org-a',
      actorUserId: 'user-1',
      actorName: 'Test User',
      actorEmail: 'user@example.com',
      actorRole: 'ORG_ADMIN',
      metadata: null,
      resourceType: 'SESSION',
      resourceId: 'session-1',
      ipAddress: '203.0.113.5',
    });
  });

  it('records a LOGIN event without an organization for users with no membership', async () => {
    authRepoMock.findUserByEmail.mockResolvedValue(userRecord());
    authRepoMock.createSession.mockResolvedValue({
      id: 'session-2',
      userId: 'user-1',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 3600000),
      revoked: false,
      createdAt: now,
      updatedAt: now,
    });
    authRepoMock.findUserOrganizationsByUserId.mockResolvedValue([]);

    await authService.loginUser({ email: 'user@example.com', password: 'correct-password' });

    expect(recordMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LOGIN',
        organizationId: null,
        actorRole: null,
        resourceId: 'session-2',
        ipAddress: '127.0.0.1',
      }),
    );
  });
});