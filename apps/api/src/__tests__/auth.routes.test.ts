import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';

vi.mock('../services/authService', () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  logoutSessionByToken: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerificationEmail: vi.fn(),
  getSessionFromToken: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock('../prisma', () => ({
  default: () => ({
    userOrganization: {
      findMany: vi.fn(async () => [{ role: 'STUDENT', organizationId: 'org-1' }]),
    },
  }),
}));

import app from '../server';
import { requireRole } from '../middleware/auth';
import * as authService from '../services/authService';

describe('Auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('registers successfully', async () => {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      vi.mocked(authService.registerUser).mockResolvedValue({
        user: {
          id: 'u1',
          name: 'Alice',
          email: 'alice@example.com',
          passwordHash: 'hashed-password',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        token: 'token-123',
        expiresAt,
        needsVerification: false,
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Alice',
          email: 'alice@example.com',
          password: 'pass1234',
          confirmPassword: 'pass1234',
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('alice@example.com');
      expect(res.headers['set-cookie']).toBeDefined();
      expect(authService.registerUser).toHaveBeenCalledWith({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'pass1234',
        ip: '::ffff:127.0.0.1',
      });
    });

    it('returns EMAIL_TAKEN for duplicate email', async () => {
      vi.mocked(authService.registerUser).mockRejectedValue(new Error('EMAIL_TAKEN'));

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Bob',
          email: 'bob@example.com',
          password: 'pass1234',
          confirmPassword: 'pass1234',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('EMAIL_TAKEN');
    });

    it('rejects invalid email addresses', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Charlie',
          email: 'not-an-email',
          password: 'pass1234',
          confirmPassword: 'pass1234',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_EMAIL');
    });

    it('rejects weak passwords', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Dana',
          email: 'dana@example.com',
          password: 'short',
          confirmPassword: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('PASSWORD_TOO_SHORT');
    });

    it('returns error for password mismatch', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Charlie',
          email: 'charlie@example.com',
          password: 'pass1234',
          confirmPassword: 'different',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('PASSWORD_MISMATCH');
    });

    it('rejects platform admin role attempts on public registration', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Emma',
          email: 'emma@example.com',
          password: 'pass1234',
          confirmPassword: 'pass1234',
          role: 'PLATFORM_ADMIN',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ROLE_NOT_ALLOWED');
    });

    it('returns error for missing fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_FIELDS');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in successfully', async () => {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      vi.mocked(authService.loginUser).mockResolvedValue({
        user: {
          id: 'u1',
          name: 'Bob',
          email: 'bob@example.com',
          passwordHash: 'hashed-password',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          role: 'PLATFORM_ADMIN',
          organizationId: 'platform-org',
        },
        token: 'token-456',
        expiresAt,
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'bob@example.com',
          password: 'pass1234',
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('bob@example.com');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('returns invalid credentials for bad login', async () => {
      vi.mocked(authService.loginUser).mockRejectedValue(new Error('INVALID_CREDENTIALS'));

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nope@example.com',
          password: 'wrong-password',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    });

    it('returns rate limit error', async () => {
      vi.mocked(authService.loginUser).mockRejectedValue(new Error('TOO_MANY_ATTEMPTS'));

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'pass1234',
        });

      expect(res.status).toBe(429);
      expect(res.body.error).toBe('TOO_MANY_ATTEMPTS');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('logout is idempotent when no cookie is present', async () => {
      const res = await request(app).post('/api/v1/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(authService.logoutSessionByToken).not.toHaveBeenCalled();
    });

    it('logs out successfully with valid session', async () => {
      vi.mocked(authService.logoutSessionByToken).mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', ['learnflow_session=valid-token']);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(authService.logoutSessionByToken).toHaveBeenCalledWith('valid-token');
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('returns success for valid email', async () => {
      vi.mocked(authService.requestPasswordReset).mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'user@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('password reset email');
    });

    it('returns success for non-existent email (no enumeration)', async () => {
      vi.mocked(authService.requestPasswordReset).mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('password reset email');
    });

    it('returns error for missing email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_EMAIL');
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('resets password successfully', async () => {
      vi.mocked(authService.resetPassword).mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'valid-reset-token',
          password: 'newpass123',
          confirmPassword: 'newpass123',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('successfully');
      expect(authService.resetPassword).toHaveBeenCalledWith('valid-reset-token', 'newpass123', '::ffff:127.0.0.1');
    });

    it('returns error for invalid token', async () => {
      vi.mocked(authService.resetPassword).mockRejectedValue(new Error('INVALID_TOKEN'));

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'newpass123',
          confirmPassword: 'newpass123',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_TOKEN');
    });

    it('returns error for expired token', async () => {
      vi.mocked(authService.resetPassword).mockRejectedValue(new Error('TOKEN_EXPIRED'));

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'expired-token',
          password: 'newpass123',
          confirmPassword: 'newpass123',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('TOKEN_EXPIRED');
    });

    it('returns error for password mismatch', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'valid-token',
          password: 'newpass123',
          confirmPassword: 'different',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('PASSWORD_MISMATCH');
    });

    it('returns error for short password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'valid-token',
          password: 'short',
          confirmPassword: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('PASSWORD_TOO_SHORT');
    });
  });

  describe('POST /api/v1/auth/verify-email', () => {
    it('verifies email successfully', async () => {
      vi.mocked(authService.verifyEmail).mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ token: 'valid-verify-token' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('verified successfully');
      expect(authService.verifyEmail).toHaveBeenCalledWith('valid-verify-token', '::ffff:127.0.0.1');
    });

    it('returns error for invalid token', async () => {
      vi.mocked(authService.verifyEmail).mockRejectedValue(new Error('INVALID_TOKEN'));

      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ token: 'invalid-token' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_TOKEN');
    });

    it('returns error for missing token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_TOKEN');
    });
  });

  describe('POST /api/v1/auth/resend-verification', () => {
    it('resends verification email', async () => {
      vi.mocked(authService.resendVerificationEmail).mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/api/v1/auth/resend-verification')
        .send({ email: 'user@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('verification email');
    });

    it('returns error for missing email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/resend-verification')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_EMAIL');
    });
  });

  describe('RBAC middleware', () => {
    it('denies users without the required role', () => {
      const req = {
        user: {
          id: 'user-1',
          name: 'Student',
          email: 'student@example.com',
          emailVerified: true,
          role: 'STUDENT',
        },
      } as unknown as AuthenticatedRequest;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      requireRole('INSTRUCTOR')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('ignores user-supplied role values during authorization', () => {
      const req = {
        user: {
          id: 'user-1',
          name: 'Student',
          email: 'student@example.com',
          emailVerified: true,
          role: 'STUDENT',
        },
        body: { role: 'PLATFORM_ADMIN' },
      } as unknown as AuthenticatedRequest;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      requireRole('ORG_ADMIN')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns user info for authenticated user', async () => {
      vi.mocked(authService.getSessionFromToken).mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 3600000),
        revoked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(authService.getUserById).mockResolvedValue({
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'hash',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', ['learnflow_session=valid-token']);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.user.emailVerified).toBe(true);
      expect(res.body.user.role).toBe('STUDENT');
    });

    it('returns 401 for unauthenticated request', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('NOT_AUTHENTICATED');
    });

    it('returns 401 for invalid session', async () => {
      vi.mocked(authService.getSessionFromToken).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', ['learnflow_session=invalid-token']);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('SESSION_INVALID');
    });
  });
});

