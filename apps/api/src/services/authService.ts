import * as repo from '../repositories/authRepository';
import { generateToken, hashToken } from '../utils/tokens';
import { getRedis } from '../utils/redis';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email';
import argon2 from 'argon2';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW = 60 * 15; // 15 minutes
const EMAIL_VERIFICATION_TTL = 60 * 60 * 24; // 24 hours
const PASSWORD_RESET_TTL = 60 * 60; // 1 hour

async function enforceRateLimit({ ip, keyPrefix, maxAttempts, windowSeconds }: { ip: string; keyPrefix: string; maxAttempts: number; windowSeconds: number }) {
  const redis = getRedis();
  const key = `rl:${keyPrefix}:ip:${ip}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) await redis.expire(key, windowSeconds);
  if (attempts > maxAttempts) throw new Error('TOO_MANY_ATTEMPTS');
}

export async function getUserById(userId: string) {
  return repo.findUserById(userId);
}

export async function registerUser({ name, email, password, sendEmail = true, ip = '127.0.0.1', role }: { name?: string; email: string; password: string; sendEmail?: boolean; ip?: string; role?: string }) {
  const normalizedEmail = email.trim().toLowerCase();
  if (role && String(role).toUpperCase() === 'PLATFORM_ADMIN') throw new Error('ROLE_NOT_ALLOWED');
  await enforceRateLimit({ ip, keyPrefix: 'register', maxAttempts: 5, windowSeconds: 60 * 15 });

  const existing = await repo.findUserByEmail(normalizedEmail);
  if (existing) throw new Error('EMAIL_TAKEN');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await repo.createUser({ name: name ?? null, email: normalizedEmail, passwordHash });

  const verificationToken = generateToken();
  const verificationTokenHash = hashToken(verificationToken);
  const verificationExpiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL * 1000);
  await repo.createEmailVerificationToken({ userId: user.id, tokenHash: verificationTokenHash, expiresAt: verificationExpiresAt });

  if (sendEmail) {
    await sendVerificationEmail(normalizedEmail, verificationToken);
  }

  const token = generateToken();
  const tokenHash = hashToken(token);
  const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await repo.createSession({ userId: user.id, tokenHash, expiresAt: sessionExpiresAt });
  return { user, token, expiresAt: sessionExpiresAt, needsVerification: !sendEmail };
}

export async function loginUser({ email, password, ip = '127.0.0.1' }: { email: string; password: string; ip?: string }) {
  await enforceRateLimit({ ip, keyPrefix: 'login', maxAttempts: LOGIN_RATE_LIMIT, windowSeconds: LOGIN_RATE_WINDOW });

  const normalizedEmail = email.trim().toLowerCase();
  const user = await repo.findUserByEmail(normalizedEmail);
  if (!user) throw new Error('INVALID_CREDENTIALS');
  const ok = await argon2.verify(user.passwordHash, password);
  if (!ok) throw new Error('INVALID_CREDENTIALS');

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await repo.createSession({ userId: user.id, tokenHash, expiresAt });
  const redis = getRedis();
  await redis.del(`rl:login:ip:${ip}`);
  return { user, token, expiresAt };
}

export async function logoutSessionByToken(token: string) {
  const tokenHash = hashToken(token);
  await repo.revokeSessionByTokenHash(tokenHash);
}

export async function getSessionFromToken(token: string) {
  const tokenHash = hashToken(token);
  const session = await repo.findSessionByTokenHash(tokenHash);
  if (!session) return null;
  if (session.revoked) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  return session;
}

export async function requestPasswordReset(input: string | { email: string; ip?: string }, ipOverride?: string) {
  const normalizedInput = typeof input === 'string' ? { email: input, ip: ipOverride ?? '127.0.0.1' } : input;
  const normalizedEmail = normalizedInput.email.trim().toLowerCase();
  await enforceRateLimit({ ip: normalizedInput.ip ?? '127.0.0.1', keyPrefix: 'forgot-password', maxAttempts: 3, windowSeconds: 60 * 60 });

  const user = await repo.findUserByEmail(normalizedEmail);
  if (!user) {
    return { success: true };
  }

  await repo.deletePasswordResetTokensByUserId(user.id);

  const resetToken = generateToken();
  const resetTokenHash = hashToken(resetToken);
  const resetExpiresAt = new Date(Date.now() + PASSWORD_RESET_TTL * 1000);
  await repo.createPasswordResetToken({ userId: user.id, tokenHash: resetTokenHash, expiresAt: resetExpiresAt });

  await sendPasswordResetEmail(normalizedEmail, resetToken);
  return { success: true };
}

export async function resetPassword(token: string, newPassword: string, ip = '127.0.0.1') {
  await enforceRateLimit({ ip, keyPrefix: 'reset-password', maxAttempts: 5, windowSeconds: 60 * 15 });

  const tokenHash = hashToken(token);
  const resetToken = await repo.findPasswordResetTokenByTokenHash(tokenHash);
  if (!resetToken) throw new Error('INVALID_TOKEN');
  if (resetToken.used) throw new Error('TOKEN_ALREADY_USED');
  if (resetToken.expiresAt.getTime() < Date.now()) throw new Error('TOKEN_EXPIRED');

  const user = await repo.findUserById(resetToken.userId);
  if (!user) throw new Error('USER_NOT_FOUND');

  const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
  await repo.updateUserPassword(user.id, passwordHash);

  await repo.markPasswordResetTokenAsUsed(resetToken.id);
  await repo.revokeAllSessionsByUserId(user.id);

  return { success: true };
}

export async function verifyEmail(token: string, ip = '127.0.0.1') {
  await enforceRateLimit({ ip, keyPrefix: 'verify-email', maxAttempts: 5, windowSeconds: 60 * 15 });

  const tokenHash = hashToken(token);
  const verificationToken = await repo.findEmailVerificationTokenByTokenHash(tokenHash);
  if (!verificationToken) throw new Error('INVALID_TOKEN');
  if (verificationToken.used) throw new Error('TOKEN_ALREADY_USED');
  if (verificationToken.expiresAt.getTime() < Date.now()) throw new Error('TOKEN_EXPIRED');

  await repo.markEmailVerificationTokenAsUsed(verificationToken.id);
  await repo.markUserEmailAsVerified(verificationToken.userId);

  return { success: true };
}

export async function resendVerificationEmail(input: string | { email: string; ip?: string }, ipOverride?: string) {
  const normalizedInput = typeof input === 'string' ? { email: input, ip: ipOverride ?? '127.0.0.1' } : input;
  const normalizedEmail = normalizedInput.email.trim().toLowerCase();
  await enforceRateLimit({ ip: normalizedInput.ip ?? '127.0.0.1', keyPrefix: 'resend-verification', maxAttempts: 3, windowSeconds: 60 * 60 });

  const user = await repo.findUserByEmail(normalizedEmail);
  if (!user) {
    return { success: true };
  }
  if (user.emailVerified) {
    return { success: true };
  }

  await repo.deleteEmailVerificationTokensByUserId(user.id);

  const verificationToken = generateToken();
  const verificationTokenHash = hashToken(verificationToken);
  const verificationExpiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL * 1000);
  await repo.createEmailVerificationToken({ userId: user.id, tokenHash: verificationTokenHash, expiresAt: verificationExpiresAt });

  await sendVerificationEmail(normalizedEmail, verificationToken);
  return { success: true };
}
