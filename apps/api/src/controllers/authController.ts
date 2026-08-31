import { Request, Response } from 'express';
import * as service from '../services/authService';
import { AuthenticatedRequest } from '../middleware/auth';

// Temporary inline validation functions until package is properly built
function isValidEmail(email: string) {
  if (typeof email !== 'string') return false;
  const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  return re.test(email);
}

function isValidPassword(password: string) {
  if (typeof password !== 'string') return false;
  return password.length >= 8;
}

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'learnflow_session';
const COOKIE_SECURE = process.env.NODE_ENV === 'production' || String(process.env.SESSION_COOKIE_SECURE || '').toLowerCase() === 'true';

function userDto(user: {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  role?: string | null;
  organizationId?: string | null;
}) {
  const base = { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt };
  return user.role ? { ...base, role: user.role, organizationId: user.organizationId } : base;
}

function getClientIp(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded?.[0] || req.ip || '127.0.0.1';
  return String(rawIp).trim() || '127.0.0.1';
}

function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  const maxAge = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    maxAge,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    expires: new Date(expiresAt),
  });
}

export async function register(req: Request, res: Response) {
  try {
    const { name, email, password, confirmPassword, role: requestedRole } = req.body;
    if (!email || !password || !confirmPassword) return res.status(400).json({ error: 'MISSING_FIELDS' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });
    if (!isValidPassword(password)) return res.status(400).json({ error: 'PASSWORD_TOO_SHORT' });
    if (password !== confirmPassword) return res.status(400).json({ error: 'PASSWORD_MISMATCH' });
    if (requestedRole && String(requestedRole).toUpperCase() === 'PLATFORM_ADMIN') {
      return res.status(403).json({ error: 'ROLE_NOT_ALLOWED' });
    }

    const { user, token, expiresAt } = await service.registerUser({ name, email, password, ip: getClientIp(req) });
    setSessionCookie(res, token, expiresAt);
    return res.json({ user: userDto(user) });
  } catch (err) {
    const message = err instanceof Error ? err.message : undefined;
    if (message === 'EMAIL_TAKEN') return res.status(409).json({ error: 'EMAIL_TAKEN' });
    if (message === 'TOO_MANY_ATTEMPTS') return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'MISSING_FIELDS' });
    const { user, token, expiresAt } = await service.loginUser({ email, password, ip: getClientIp(req) });
    
    setSessionCookie(res, token, expiresAt);
    return res.json({ user: userDto(user) });
  } catch (err) {
    const message = err instanceof Error ? err.message : undefined;
    if (message === 'INVALID_CREDENTIALS') return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    if (message === 'TOO_MANY_ATTEMPTS') return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const token = req.cookies?.[COOKIE_NAME] || null;
    if (!token) {
      res.clearCookie(COOKIE_NAME, { path: '/', sameSite: 'lax', secure: COOKIE_SECURE });
      return res.json({ ok: true });
    }
    await service.logoutSessionByToken(token);
    res.clearCookie(COOKIE_NAME, { path: '/', sameSite: 'lax', secure: COOKIE_SECURE });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false });
  }
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'MISSING_EMAIL' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });

    await service.requestPasswordReset({ email, ip: getClientIp(req) });
    return res.json({ message: 'If an account exists, a password reset email has been sent' });
  } catch (err) {
    const message = err instanceof Error ? err.message : undefined;
    if (message === 'TOO_MANY_ATTEMPTS') return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, password, confirmPassword } = req.body;
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ error: 'MISSING_FIELDS' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'PASSWORD_MISMATCH' });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: 'PASSWORD_TOO_SHORT' });
    }

    await service.resetPassword(token, password, getClientIp(req));
    return res.json({ message: 'Password reset successfully' });
  } catch (err) {
    const message = err instanceof Error ? err.message : undefined;
    if (message === 'INVALID_TOKEN') return res.status(400).json({ error: 'INVALID_TOKEN' });
    if (message === 'TOKEN_ALREADY_USED') return res.status(400).json({ error: 'TOKEN_ALREADY_USED' });
    if (message === 'TOKEN_EXPIRED') return res.status(400).json({ error: 'TOKEN_EXPIRED' });
    if (message === 'TOO_MANY_ATTEMPTS') return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
}

export async function verifyEmail(req: Request, res: Response) {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'MISSING_TOKEN' });

    await service.verifyEmail(token, getClientIp(req));
    return res.json({ message: 'Email verified successfully' });
  } catch (err) {
    const message = err instanceof Error ? err.message : undefined;
    if (message === 'INVALID_TOKEN') return res.status(400).json({ error: 'INVALID_TOKEN' });
    if (message === 'TOKEN_ALREADY_USED') return res.status(400).json({ error: 'TOKEN_ALREADY_USED' });
    if (message === 'TOKEN_EXPIRED') return res.status(400).json({ error: 'TOKEN_EXPIRED' });
    if (message === 'TOO_MANY_ATTEMPTS') return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
}

export async function resendVerification(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'MISSING_EMAIL' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });

    await service.resendVerificationEmail({ email, ip: getClientIp(req) });
    return res.json({ message: 'If unverified, a verification email has been sent' });
  } catch (err) {
    const message = err instanceof Error ? err.message : undefined;
    if (message === 'TOO_MANY_ATTEMPTS') return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'NOT_AUTHENTICATED' });
    }

    return res.json({
      user: userDto({
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        emailVerified: req.user.emailVerified,
        createdAt: req.user.createdAt ?? new Date(),
        role: req.user.role,
        organizationId: req.user.organizationId,
      }),
    });
  } catch {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
}

export async function updateEmail(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'NOT_AUTHENTICATED' });
    }

    const { email } = req.body ?? {};
    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'MISSING_EMAIL' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'INVALID_EMAIL' });
    }

    const { user } = await service.updateUserEmail({ userId: req.user.id, email, ip: getClientIp(req) });

    return res.json({
      user: userDto({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        role: req.user.role,
        organizationId: req.user.organizationId,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : undefined;
    if (message === 'EMAIL_TAKEN') return res.status(409).json({ error: 'EMAIL_TAKEN' });
    if (message === 'USER_NOT_FOUND') return res.status(401).json({ success: false, error: 'USER_NOT_FOUND' });
    if (message === 'TOO_MANY_ATTEMPTS') return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'NOT_AUTHENTICATED' });
    }

    const { currentPassword, newPassword, confirmNewPassword } = req.body ?? {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || typeof confirmNewPassword !== 'string') {
      return res.status(400).json({ error: 'MISSING_FIELDS' });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ error: 'PASSWORD_MISMATCH' });
    }
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ error: 'PASSWORD_TOO_SHORT' });
    }

    const token = req.cookies?.[COOKIE_NAME] || null;
    await service.changePassword({
      userId: req.user.id,
      currentPassword,
      newPassword,
      sessionToken: token,
      ip: getClientIp(req),
    });

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    const message = err instanceof Error ? err.message : undefined;
    if (message === 'INVALID_CURRENT_PASSWORD') return res.status(400).json({ error: 'INVALID_CURRENT_PASSWORD' });
    if (message === 'USER_NOT_FOUND') return res.status(401).json({ success: false, error: 'USER_NOT_FOUND' });
    if (message === 'TOO_MANY_ATTEMPTS') return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
}
