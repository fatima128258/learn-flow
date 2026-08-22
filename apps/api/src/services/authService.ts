import * as repo from '../repositories/authRepository';

// Helper to get user by ID
export async function getUserById(userId: string) {
  return repo.findUserById(userId);
}
import { generateToken, hashToken } from '../utils/tokens';
import { getRedis } from '../utils/redis';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email';
import argon2 from 'argon2';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW = 60 * 15; // 15 minutes
const EMAIL_VERIFICATION_TTL = 60 * 60 * 24; // 24 hours
const PASSWORD_RESET_TTL = 60 * 60; // 1 hour

export async function registerUser({ name, email, password, sendEmail = true }: { name?: string; email: string; password: string; sendEmail?: boolean }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await repo.findUserByEmail(normalizedEmail);
  if (existing) throw new Error('EMAIL_TAKEN');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await repo.createUser({ name: name ?? null, email: normalizedEmail, passwordHash });
  
  // Generate verification token
  const verificationToken = generateToken();
  const verificationTokenHash = hashToken(verificationToken);
  const verificationExpiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL * 1000);
  await repo.createEmailVerificationToken({ userId: user.id, tokenHash: verificationTokenHash, expiresAt: verificationExpiresAt });
  
  // Send verification email
  if (sendEmail) {
    await sendVerificationEmail(normalizedEmail, verificationToken);
  }
  
  // Create session
  const token = generateToken();
  const tokenHash = hashToken(token);
  const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await repo.createSession({ userId: user.id, tokenHash, expiresAt: sessionExpiresAt });
  return { user, token, expiresAt: sessionExpiresAt, needsVerification: !sendEmail };
}

export async function loginUser({ email, password, ip }: { email: string; password: string; ip: string }) {
  const redis = getRedis();
  const key = `rl:login:ip:${ip}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) await redis.expire(key, LOGIN_RATE_WINDOW);
  if (attempts > LOGIN_RATE_LIMIT) throw new Error('TOO_MANY_ATTEMPTS');

  const normalizedEmail = email.trim().toLowerCase();
  const user = await repo.findUserByEmail(normalizedEmail);
  if (!user) throw new Error('INVALID_CREDENTIALS');
  const ok = await argon2.verify(user.passwordHash, password);
  if (!ok) throw new Error('INVALID_CREDENTIALS');

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await repo.createSession({ userId: user.id, tokenHash, expiresAt });
  await redis.del(key);
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

// Password Reset Functions
export async function requestPasswordReset(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await repo.findUserByEmail(normalizedEmail);
  if (!user) {
    // Don't reveal if email exists
    return { success: true };
  }

  // Invalidate any existing password reset tokens
  await repo.deletePasswordResetTokensByUserId(user.id);

  const resetToken = generateToken();
  const resetTokenHash = hashToken(resetToken);
  const resetExpiresAt = new Date(Date.now() + PASSWORD_RESET_TTL * 1000);
  await repo.createPasswordResetToken({ userId: user.id, tokenHash: resetTokenHash, expiresAt: resetExpiresAt });

  await sendPasswordResetEmail(normalizedEmail, resetToken);
  return { success: true };
}

export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = hashToken(token);
  const resetToken = await repo.findPasswordResetTokenByTokenHash(tokenHash);
  if (!resetToken) throw new Error('INVALID_TOKEN');
  if (resetToken.used) throw new Error('TOKEN_ALREADY_USED');
  if (resetToken.expiresAt.getTime() < Date.now()) throw new Error('TOKEN_EXPIRED');

  // Get the user
  const user = await repo.findUserById(resetToken.userId);
  if (!user) throw new Error('USER_NOT_FOUND');

  // Update password
  const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
  await repo.updateUserPassword(user.id, passwordHash);

  // Mark token as used and revoke all existing sessions (security measure)
  await repo.markPasswordResetTokenAsUsed(resetToken.id);
  await repo.revokeAllSessionsByUserId(user.id);

  return { success: true };
}

// Email Verification Functions
export async function verifyEmail(token: string) {
  const tokenHash = hashToken(token);
  const verificationToken = await repo.findEmailVerificationTokenByTokenHash(tokenHash);
  if (!verificationToken) throw new Error('INVALID_TOKEN');
  if (verificationToken.used) throw new Error('TOKEN_ALREADY_USED');
  if (verificationToken.expiresAt.getTime() < Date.now()) throw new Error('TOKEN_EXPIRED');

  // Mark token as used
  await repo.markEmailVerificationTokenAsUsed(verificationToken.id);

  // Update user emailVerified status
  await repo.markUserEmailAsVerified(verificationToken.userId);

  return { success: true };
}

export async function resendVerificationEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await repo.findUserByEmail(normalizedEmail);
  if (!user) {
    // Don't reveal if email exists
    return { success: true };
  }
  if (user.emailVerified) {
    // Already verified
    return { success: true };
  }

  // Delete any existing unexpired verification tokens
  await repo.deleteEmailVerificationTokensByUserId(user.id);

  // Create new verification token
  const verificationToken = generateToken();
  const verificationTokenHash = hashToken(verificationToken);
  const verificationExpiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL * 1000);
  await repo.createEmailVerificationToken({ userId: user.id, tokenHash: verificationTokenHash, expiresAt: verificationExpiresAt });

  await sendVerificationEmail(normalizedEmail, verificationToken);
  return { success: true };
}
