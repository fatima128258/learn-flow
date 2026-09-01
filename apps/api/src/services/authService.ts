import * as repo from '../repositories/authRepository';
import { generateToken, hashToken } from '../utils/tokens';
import { getRedis } from '../utils/redis';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email';
import { dispatchNotification } from './notificationDispatcher';
import { record as recordAudit } from './auditLogService';
import argon2 from 'argon2';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
// The assignment requires throttling "repeated login requests" but specifies no
// exact numbers, so keep generous defaults (per IP) that block plainly abusive
// bursts while not locking out real users during demos/tests. Overridable via env.
export const LOGIN_RATE_LIMIT = Number(process.env.AUTH_LOGIN_RATE_LIMIT ?? 10);
const LOGIN_RATE_WINDOW = 60 * 15; // 15 minutes
export const REGISTER_RATE_LIMIT = Number(process.env.AUTH_REGISTER_RATE_LIMIT ?? 10);
const REGISTER_RATE_WINDOW = 60 * 15; // 15 minutes
const EMAIL_VERIFICATION_TTL = 60 * 60 * 24; // 24 hours
const PASSWORD_RESET_TTL = 60 * 60; // 1 hour

async function enforceRateLimit({ ip, keyPrefix, maxAttempts, windowSeconds }: { ip: string; keyPrefix: string; maxAttempts: number; windowSeconds: number }) {
  const redis = getRedis();
  const key = `rl:${keyPrefix}:ip:${ip}`;
  try {
    const attempts = await redis.incr(key);
    if (attempts === 1) await redis.expire(key, windowSeconds);
    if (attempts > maxAttempts) throw new Error('TOO_MANY_ATTEMPTS');
  } catch (err) {
    if (err instanceof Error && err.message === 'TOO_MANY_ATTEMPTS') throw err;
    // Fail open: if Redis is unreachable, allow the request through
    console.warn(`[enforceRateLimit] Redis error, failing open: ${err instanceof Error ? err.message : err}`);
  }
}

export async function getUserById(userId: string) {
  return repo.findUserById(userId);
}

async function getPrimaryOrganizationId(userId: string) {
  const memberships: Array<{ role?: string; organizationId?: string }> = await repo.findUserOrganizationsByUserId(userId);
  const primary = memberships.find((membership) => membership.role === 'PLATFORM_ADMIN')
    ?? memberships.find((membership) => membership.role === 'ORG_ADMIN')
    ?? memberships.find((membership) => membership.role === 'INSTRUCTOR')
    ?? memberships[0];
  return primary?.organizationId ?? null;
}

export async function registerUser({ name, email, password, sendEmail = true, ip = '127.0.0.1', role }: { name?: string; email: string; password: string; sendEmail?: boolean; ip?: string; role?: string }) {
  const normalizedEmail = email.trim().toLowerCase();
  if (role && String(role).toUpperCase() === 'PLATFORM_ADMIN') throw new Error('ROLE_NOT_ALLOWED');
  await enforceRateLimit({ ip, keyPrefix: 'register', maxAttempts: REGISTER_RATE_LIMIT, windowSeconds: REGISTER_RATE_WINDOW });

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
  const session = await repo.createSession({ userId: user.id, tokenHash, expiresAt });
  const redis = getRedis();
  await redis.del(`rl:login:ip:${ip}`);

  const memberships: Array<{ role?: string; organizationId?: string }> = await repo.findUserOrganizationsByUserId(user.id);
  const primaryMembership = memberships.find((membership) => membership.role === 'PLATFORM_ADMIN')
    ?? memberships.find((membership) => membership.role === 'ORG_ADMIN')
    ?? memberships.find((membership) => membership.role === 'INSTRUCTOR')
    ?? memberships[0];

  await recordAudit({
    action: 'LOGIN',
    organizationId: primaryMembership?.organizationId ?? null,
    actorUserId: user.id,
    actorName: user.name ?? null,
    actorEmail: user.email,
    actorRole: primaryMembership?.role ?? null,
    resourceType: 'SESSION',
    resourceId: session?.id ?? null,
    ipAddress: ip,
  });

  return {
    user: {
      ...user,
      role: primaryMembership?.role,
      organizationId: primaryMembership?.organizationId,
    },
    token,
    expiresAt,
  };
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
  await enforceRateLimit({ ip: normalizedInput.ip ?? '127.0.0.1', keyPrefix: 'forgot-password', maxAttempts: 5, windowSeconds: 60 * 60 });

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
  await enforceRateLimit({ ip, keyPrefix: 'reset-password', maxAttempts: 10, windowSeconds: 60 * 15 });

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

  const primaryOrganizationId = await getPrimaryOrganizationId(user.id);
  if (primaryOrganizationId) {
    await dispatchNotification({
      type: 'PASSWORD_RESET',
      title: 'Password reset',
      body: 'Your LearnFlow password was reset successfully.',
      data: { organizationName: primaryOrganizationId },
      userId: user.id,
      organizationId: primaryOrganizationId,
      email: { name: user.name },
    });
  }

  return { success: true };
}

export async function verifyEmail(token: string, ip = '127.0.0.1') {
  await enforceRateLimit({ ip, keyPrefix: 'verify-email', maxAttempts: 10, windowSeconds: 60 * 15 });

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
  await enforceRateLimit({ ip: normalizedInput.ip ?? '127.0.0.1', keyPrefix: 'resend-verification', maxAttempts: 5, windowSeconds: 60 * 60 });

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

export async function updateUserEmail({ userId, email, ip = '127.0.0.1' }: { userId: string; email: string; ip?: string }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await repo.findUserById(userId);
  if (!user) throw new Error('USER_NOT_FOUND');

  if (user.email === normalizedEmail) {
    return { success: true, user };
  }

  const existing = await repo.findUserByEmail(normalizedEmail);
  if (existing && existing.id !== userId) throw new Error('EMAIL_TAKEN');

  await repo.updateUserEmail(userId, normalizedEmail);

  await repo.deleteEmailVerificationTokensByUserId(userId);
  const verificationToken = generateToken();
  const verificationTokenHash = hashToken(verificationToken);
  const verificationExpiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL * 1000);
  await repo.createEmailVerificationToken({ userId, tokenHash: verificationTokenHash, expiresAt: verificationExpiresAt });
  await sendVerificationEmail(normalizedEmail, verificationToken);

  const primaryOrganizationId = await getPrimaryOrganizationId(userId);
  await recordAudit({
    action: 'EMAIL_UPDATED',
    organizationId: primaryOrganizationId,
    actorUserId: userId,
    actorName: user.name ?? null,
    actorEmail: normalizedEmail,
    actorRole: null,
    resourceType: 'USER',
    resourceId: userId,
    ipAddress: ip,
  });

  const updated = await repo.findUserById(userId);
  return { success: true, user: updated ?? user };
}

export async function changePassword({ userId, currentPassword, newPassword, sessionToken, ip = '127.0.0.1' }: { userId: string; currentPassword: string; newPassword: string; sessionToken?: string | null; ip?: string }) {
  const user = await repo.findUserById(userId);
  if (!user) throw new Error('USER_NOT_FOUND');

  const currentOk = await argon2.verify(user.passwordHash, currentPassword);
  if (!currentOk) throw new Error('INVALID_CURRENT_PASSWORD');

  const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
  await repo.updateUserPassword(userId, passwordHash);

  if (sessionToken) {
    await repo.revokeOtherSessionsByUserId(userId, hashToken(sessionToken));
  }

  const primaryOrganizationId = await getPrimaryOrganizationId(userId);
  if (primaryOrganizationId) {
    await dispatchNotification({
      type: 'PASSWORD_RESET',
      title: 'Password changed',
      body: 'Your LearnFlow password was changed successfully.',
      data: { organizationName: primaryOrganizationId },
      userId,
      organizationId: primaryOrganizationId,
      email: { name: user.name },
    });
  }

  await recordAudit({
    action: 'PASSWORD_CHANGED',
    organizationId: primaryOrganizationId,
    actorUserId: userId,
    actorName: user.name ?? null,
    actorEmail: user.email,
    actorRole: null,
    resourceType: 'USER',
    resourceId: userId,
    ipAddress: ip,
  });

  return { success: true };
}
