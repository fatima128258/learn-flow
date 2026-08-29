import { beforeEach, describe, expect, it, vi } from 'vitest';

const LOGIN_LIMIT = 5;

const state = vi.hoisted(() => ({ count: 0 }));

vi.mock('../utils/redis', () => ({
  getRedis: () => ({
    incr: vi.fn(async () => {
      state.count += 1;
      return state.count;
    }),
    expire: vi.fn(async () => 1),
    del: vi.fn(async () => 1),
  }),
}));

vi.mock('../repositories/authRepository', () => ({
  findUserByEmail: vi.fn(async () => null),
}));

import { loginUser, requestPasswordReset } from '../services/authService';

describe('Brute-force authentication protection (Section 16)', () => {
  beforeEach(() => {
    state.count = 0;
  });

  it('locks out login attempts from the same IP after the limit', async () => {
    for (let i = 0; i < LOGIN_LIMIT; i++) {
      await expect(loginUser({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow(
        'INVALID_CREDENTIALS',
      );
    }

    await expect(loginUser({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow(
      'TOO_MANY_ATTEMPTS',
    );
  });

  it('limits password reset requests from the same IP', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(
        requestPasswordReset({ email: 'a@b.com', ip: '127.0.0.1' }),
      ).resolves.toEqual({ success: true });
    }

    await expect(requestPasswordReset({ email: 'a@b.com', ip: '127.0.0.1' })).rejects.toThrow(
      'TOO_MANY_ATTEMPTS',
    );
  });
});