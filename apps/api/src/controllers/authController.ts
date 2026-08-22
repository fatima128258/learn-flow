import { Request, Response } from 'express';
import * as service from '../services/authService';

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'learnflow_session';
const COOKIE_SECURE = String(process.env.SESSION_COOKIE_SECURE || 'false') === 'true';
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || '604800');

function userDto(user: any) {
  return { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt };
}

export async function register(req: Request, res: Response) {
  try {
    const { name, email, password, confirmPassword } = req.body;
    if (!email || !password || !confirmPassword) return res.status(400).json({ error: 'MISSING_FIELDS' });
    if (password !== confirmPassword) return res.status(400).json({ error: 'PASSWORD_MISMATCH' });

    const { user, token, expiresAt } = await service.registerUser({ name, email, password });
    const maxAge = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
    res.cookie(COOKIE_NAME, token, { httpOnly: true, path: '/', maxAge: maxAge * 1000, sameSite: 'lax', secure: COOKIE_SECURE });
    return res.json({ user: userDto(user) });
  } catch (err: any) {
    if (err.message === 'EMAIL_TAKEN') return res.status(409).json({ error: 'EMAIL_TAKEN' });
    if (err.message === 'TOO_MANY_ATTEMPTS') return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'MISSING_FIELDS' });
    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const { user, token, expiresAt } = await service.loginUser({ email, password, ip: String(ip) });
    const maxAge = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
    res.cookie(COOKIE_NAME, token, { httpOnly: true, path: '/', maxAge: maxAge * 1000, sameSite: 'lax', secure: COOKIE_SECURE });
    return res.json({ user: userDto(user) });
  } catch (err: any) {
    if (err.message === 'INVALID_CREDENTIALS') return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    if (err.message === 'TOO_MANY_ATTEMPTS') return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const token = req.cookies?.[COOKIE_NAME] || null;
    if (!token) {
      res.clearCookie(COOKIE_NAME, { path: '/' });
      return res.json({ ok: true });
    }
    await service.logoutSessionByToken(token);
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false });
  }
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'MISSING_EMAIL' });

    await service.requestPasswordReset(email);
    // Always return success to avoid email enumeration
    return res.json({ message: 'If an account exists, a password reset email has been sent' });
  } catch (err: any) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
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
    if (password.length < 8) {
      return res.status(400).json({ error: 'PASSWORD_TOO_SHORT' });
    }

    await service.resetPassword(token, password);
    return res.json({ message: 'Password reset successfully' });
  } catch (err: any) {
    if (err.message === 'INVALID_TOKEN') return res.status(400).json({ error: 'INVALID_TOKEN' });
    if (err.message === 'TOKEN_ALREADY_USED') return res.status(400).json({ error: 'TOKEN_ALREADY_USED' });
    if (err.message === 'TOKEN_EXPIRED') return res.status(400).json({ error: 'TOKEN_EXPIRED' });
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}

export async function verifyEmail(req: Request, res: Response) {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'MISSING_TOKEN' });

    await service.verifyEmail(token);
    return res.json({ message: 'Email verified successfully' });
  } catch (err: any) {
    if (err.message === 'INVALID_TOKEN') return res.status(400).json({ error: 'INVALID_TOKEN' });
    if (err.message === 'TOKEN_ALREADY_USED') return res.status(400).json({ error: 'TOKEN_ALREADY_USED' });
    if (err.message === 'TOKEN_EXPIRED') return res.status(400).json({ error: 'TOKEN_EXPIRED' });
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}

export async function resendVerification(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'MISSING_EMAIL' });

    await service.resendVerificationEmail(email);
    // Always return success to avoid email enumeration
    return res.json({ message: 'If unverified, a verification email has been sent' });
  } catch (err: any) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    const token = req.cookies?.[COOKIE_NAME] || null;
    if (!token) {
      return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
    }

    const session = await service.getSessionFromToken(token);
    if (!session) {
      return res.status(401).json({ error: 'SESSION_INVALID' });
    }

    const user = await service.getUserById(session.userId);
    if (!user) {
      return res.status(401).json({ error: 'USER_NOT_FOUND' });
    }

    return res.json({ 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        emailVerified: user.emailVerified,
        createdAt: user.createdAt 
      } 
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}
