import crypto from 'crypto';
import * as repo from '../repositories/authRepository';
import * as orgRepo from '../repositories/organizationRepository';
import getPrisma from '../prisma';
import { generateToken, hashToken } from '../utils/tokens';
import { getRedis } from '../utils/redis';
import { sendVerificationEmail, sendPasswordResetEmail, sendPasswordResetCodeEmail } from '../utils/email';
import { dispatchNotification } from './notificationDispatcher';
import { record as recordAudit } from './auditLogService';
import { getEmailQueue, isEmailQueueEnabled } from '../queues/emailQueue';
import argon2 from 'argon2';
import { isValidEmail, normalizeEmail } from '../utils/validation';
import { durationMs, logAuthPerf, now, type AuthPerfContext } from '../utils/authPerf';

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
const PASSWORD_RESET_CODE_TTL = 10 * 60; // 10 minutes
const PASSWORD_RESET_MAX_ATTEMPTS = 5;

function generateSixDigitCode() {
  return crypto.randomInt(100000, 1000000).toString().padStart(6, '0');
}

async function enforceRateLimit({ ip, keyPrefix, maxAttempts, windowSeconds, perf }: { ip: string; keyPrefix: string; maxAttempts: number; windowSeconds: number; perf?: AuthPerfContext }) {
  const redis = getRedis();
  const key = `rl:${keyPrefix}:ip:${ip}`;
  const incrStart = now();
  try {
    const attempts = await redis.incr(key);
    const incrMs = durationMs(incrStart);
    if (perf) {
      perf.redisLoginMs = incrMs;
      logAuthPerf(perf.requestId, 'redis_login_incr', incrMs);
    }
    if (attempts === 1) {
      const expireStart = now();
      await redis.expire(key, windowSeconds);
      const expireMs = durationMs(expireStart);
      if (perf) logAuthPerf(perf.requestId, 'redis_login_expire', expireMs);
    }
    if (attempts > maxAttempts) throw new Error('TOO_MANY_ATTEMPTS');
  } catch (err) {
    const incrMs = durationMs(incrStart);
    if (perf) {
      perf.redisLoginMs = incrMs;
      logAuthPerf(perf.requestId, 'redis_login_incr', incrMs);
    }
    if (err instanceof Error && err.message === 'TOO_MANY_ATTEMPTS') throw err;
    // Fail open: if Redis is unreachable, allow the request through
    console.warn(`[enforceRateLimit] Redis error, failing open: ${err instanceof Error ? err.message : err}`);
  }
}

export async function getUserById(userId: string) {
  return repo.findUserById(userId);
}

async function getPrimaryOrganizationId(userId: string) {
  // OPTIMIZATION: Query directly for primary org instead of fetching all, then filtering in app
  // Priority order: PLATFORM_ADMIN > ORG_ADMIN > INSTRUCTOR > STUDENT
  // Use database query to do the filtering at query level
  const membership = await repo.findUserPrimaryOrganization(userId);
  return membership?.organizationId ?? null;
}

export async function registerUser({ name, email, password, sendEmail = true, ip = '127.0.0.1', role }: { name?: string; email: string; password: string; sendEmail?: boolean; ip?: string; role?: string }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('INVALID_EMAIL');
  if (role && String(role).toUpperCase() === 'PLATFORM_ADMIN') throw new Error('ROLE_NOT_ALLOWED');
  
  // OPTIMIZATION #1: Rate limit check (early validation)
  await enforceRateLimit({ ip, keyPrefix: 'register', maxAttempts: REGISTER_RATE_LIMIT, windowSeconds: REGISTER_RATE_WINDOW });

  // OPTIMIZATION #2: Check for existing email (must be done before hashing to fail fast)
  const existing = await repo.findUserByEmail(normalizedEmail);
  if (existing) throw new Error('EMAIL_TAKEN');

  // OPTIMIZATION #3: Hash password with optimized argon2 settings
  // Using faster default settings for faster signup (still secure)
  // argon2id is used for balance between speed and resistance to GPU attacks
  const passwordHash = await argon2.hash(password, { 
    type: argon2.argon2id,
    memoryCost: 19456,  // 19 MB (default, balanced)
    timeCost: 2,        // 2 iterations (faster, still secure enough for signup)
    parallelism: 1      // 1 thread (default)
  });
  
  // OPTIMIZATION #4: Parallelize user creation and org lookup
  // These are independent operations, so we can run them in parallel
  const [user, defaultOrg] = await Promise.all([
    repo.createUser({ name: name ?? null, email: normalizedEmail, passwordHash }),
    orgRepo.findOrganizationBySlug('default'),
  ]);

  // OPTIMIZATION #5: Parallelize database writes (organization and verification token creation)
  // These are independent and can run concurrently
  const userOrgPromise = defaultOrg
    ? getPrisma().userOrganization.create({
        data: {
          userId: user.id,
          organizationId: defaultOrg.id,
          role: 'STUDENT',
        },
      })
    : null;

  const verificationToken = generateToken();
  const verificationTokenHash = hashToken(verificationToken);
  const verificationExpiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL * 1000);
  
  const verificationPromise = repo.createEmailVerificationToken({
    userId: user.id,
    tokenHash: verificationTokenHash,
    expiresAt: verificationExpiresAt,
  });

  // Run both in parallel
  await Promise.all([userOrgPromise, verificationPromise]);

  // OPTIMIZATION #6: Create session
  const token = generateToken();
  const tokenHash = hashToken(token);
  const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await repo.createSession({ userId: user.id, tokenHash, expiresAt: sessionExpiresAt });

  // OPTIMIZATION #7: Queue email sending to background job (FIRE-AND-FORGET)
  // This is the biggest performance win - don't wait for SMTP delivery
  if (sendEmail) {
    if (isEmailQueueEnabled()) {
      // Queue the email job - it will be processed in background
      // Don't await or catch - just fire and forget
      getEmailQueue()
        .add('send-verification-email', {
          type: 'verification',
          email: normalizedEmail,
          token: verificationToken,
        })
        .catch((err) => {
          console.error('Failed to queue verification email:', err);
          sendVerificationEmail(normalizedEmail, verificationToken).catch((fallbackErr) => {
            console.error('Failed to send verification email:', fallbackErr);
          });
        });
    } else {
      // Fallback: send email without blocking (with .catch to prevent unhandled rejection)
      sendVerificationEmail(normalizedEmail, verificationToken).catch((err) => {
        console.error('Failed to send verification email:', err);
      });
    }
  }

  // OPTIMIZATION #8: Return immediately with known data
  // We already know the role is STUDENT and org is defaultOrg
  // REMOVED: The redundant findUserOrganizationsByUserId query
  // This saves one database round-trip (10-50ms) on every signup
  return {
    user: {
      ...user,
      role: 'STUDENT',
      organizationId: defaultOrg?.id ?? null,
    },
    token,
    expiresAt: sessionExpiresAt,
    needsVerification: !sendEmail,
  };
}

export async function loginUser({ email, password, ip = '127.0.0.1', perf }: { email: string; password: string; ip?: string; perf?: AuthPerfContext }) {
  if (!isValidEmail(email)) throw new Error('INVALID_EMAIL');
  await enforceRateLimit({ ip, keyPrefix: 'login', maxAttempts: LOGIN_RATE_LIMIT, windowSeconds: LOGIN_RATE_WINDOW, perf });

  const normalizedEmail = normalizeEmail(email)!;
  const userLookupStart = now();
  const user = await repo.findUserByEmail(normalizedEmail);
  const userLookupMs = durationMs(userLookupStart);
  if (perf) {
    perf.dbUserLookupMs = userLookupMs;
    logAuthPerf(perf.requestId, 'db_user_lookup', userLookupMs);
  }
  if (!user) throw new Error('INVALID_CREDENTIALS');
  const argon2Start = now();
  const ok = await argon2.verify(user.passwordHash, password);
  const argon2Ms = durationMs(argon2Start);
  if (perf) {
    perf.argon2Ms = argon2Ms;
    logAuthPerf(perf.requestId, 'argon2_verify', argon2Ms);
  }
  if (!ok) throw new Error('INVALID_CREDENTIALS');

  const membershipStart = now();
  const memberships: Array<{ role?: string; organizationId?: string; status?: string }> = await repo.findUserOrganizationsByUserId(user.id);
  const membershipMs = durationMs(membershipStart);
  if (perf) {
    perf.membershipMs = membershipMs;
    logAuthPerf(perf.requestId, 'db_membership_lookup', membershipMs);
  }
  const primaryMembership = memberships.find((membership) => membership.role === 'PLATFORM_ADMIN')
    ?? memberships.find((membership) => membership.role === 'ORG_ADMIN')
    ?? memberships.find((membership) => membership.role === 'INSTRUCTOR')
    ?? memberships[0];
  if (primaryMembership?.status === 'SUSPENDED') throw new Error('ACCOUNT_SUSPENDED');

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const sessionStart = now();
  const session = await repo.createSession({ userId: user.id, tokenHash, expiresAt });
  const sessionMs = durationMs(sessionStart);
  if (perf) {
    perf.sessionMs = sessionMs;
    logAuthPerf(perf.requestId, 'db_session_create', sessionMs);
  }
  const redis = getRedis();
  const redisCleanupStart = now();
  try {
    await redis.del(`rl:login:ip:${ip}`);
    const redisCleanupMs = durationMs(redisCleanupStart);
    if (perf) {
      perf.redisCleanupMs = redisCleanupMs;
      logAuthPerf(perf.requestId, 'redis_login_cleanup_del', redisCleanupMs);
    }
  } catch (err) {
    const redisCleanupMs = durationMs(redisCleanupStart);
    if (perf) {
      perf.redisCleanupMs = redisCleanupMs;
      logAuthPerf(perf.requestId, 'redis_login_cleanup_del', redisCleanupMs);
    }
    // Rate-limit cleanup is non-critical after a successful login.
    console.warn(`[loginUser] Unable to clear login rate limit: ${err instanceof Error ? err.message : err}`);
  }

  void recordAudit({
    action: 'LOGIN',
    organizationId: primaryMembership?.organizationId ?? null,
    actorUserId: user.id,
    actorName: user.name ?? null,
    actorEmail: user.email,
    actorRole: primaryMembership?.role ?? null,
    resourceType: 'SESSION',
    resourceId: session?.id ?? null,
    ipAddress: ip,
  }).catch((err: unknown) => {
    console.error('[auth.login] Audit logging failed after successful login:', err instanceof Error ? err.message : 'Unknown error');
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
  const normalizedEmail = normalizeEmail(normalizedInput.email);
  if (!normalizedEmail) throw new Error('INVALID_EMAIL');
  await enforceRateLimit({ ip: normalizedInput.ip ?? '127.0.0.1', keyPrefix: 'forgot-password', maxAttempts: 5, windowSeconds: 60 * 60 });

  const user = await repo.findUserByEmail(normalizedEmail);
  if (!user) {
    return { success: true };
  }

  const priorRecords = await repo.findPasswordResetTokensByUserId(user.id);
  for (const record of priorRecords) {
    if (!record.used && record.expiresAt.getTime() > Date.now()) {
      await repo.updatePasswordResetToken(record.id, {
        used: true,
        usedAt: new Date(),
        expiresAt: new Date(Date.now() - 1000),
      });
    }
  }

  const code = generateSixDigitCode();
  const codeHash = hashToken(code);
  const resetToken = generateToken();
  const resetTokenHash = hashToken(resetToken);
  const resetExpiresAt = new Date(Date.now() + PASSWORD_RESET_CODE_TTL * 1000);
  const resetRecord = await repo.createPasswordResetToken({
    userId: user.id,
    tokenHash: resetTokenHash,
    codeHash,
    expiresAt: resetExpiresAt,
    attempts: 0,
    verifiedAt: null,
    usedAt: null,
    used: false,
  });

  if (isEmailQueueEnabled()) {
    getEmailQueue()
      .add('send-password-reset-code-email', {
        type: 'password-reset-code',
        email: normalizedEmail,
        code,
      })
      .catch((err) => {
        console.error('Failed to queue password reset code email:', err);
        sendPasswordResetCodeEmail(normalizedEmail, code).catch((fallbackErr) => {
          console.error('Failed to send password reset code email:', fallbackErr);
        });
      });
  } else {
    if (process.env.EMAIL_ASYNC_DELIVERY === 'true') {
      void sendPasswordResetCodeEmail(normalizedEmail, code).catch((err) => {
        console.error('Failed to send password reset code email:', err);
      });
    } else {
      try {
        await sendPasswordResetCodeEmail(normalizedEmail, code);
      } catch (err) {
        await repo.deletePasswordResetTokenById(resetRecord.id);
        throw err;
      }
    }
  }

  return { success: true };
}

export async function verifyPasswordResetCode({ email, code, ip = '127.0.0.1' }: { email: string; code: string; ip?: string }) {
  await enforceRateLimit({ ip, keyPrefix: 'forgot-password-verify', maxAttempts: 10, windowSeconds: 60 * 15 });

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('INVALID_EMAIL');
  const user = await repo.findUserByEmail(normalizedEmail);
  if (!user) throw new Error('INVALID_CODE');

  const records = await repo.findPasswordResetTokensByUserId(user.id);
  const resetRecord = records.find((record) => !record.used) ?? null;
  if (!resetRecord || !resetRecord.codeHash) throw new Error('INVALID_CODE');

  if (resetRecord.expiresAt.getTime() < Date.now()) {
    await repo.updatePasswordResetToken(resetRecord.id, { used: true, usedAt: new Date(), expiresAt: new Date(Date.now() - 1000) });
    throw new Error('CODE_EXPIRED');
  }

  const hashedInputCode = hashToken(code);
  const attempts = (resetRecord.attempts ?? 0) + 1;
  if (resetRecord.codeHash !== hashedInputCode) {
    await repo.updatePasswordResetToken(resetRecord.id, { attempts });
    if (attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
      await repo.updatePasswordResetToken(resetRecord.id, {
        used: true,
        usedAt: new Date(),
        expiresAt: new Date(Date.now() - 1000),
      });
      throw new Error('TOO_MANY_ATTEMPTS');
    }
    throw new Error('INVALID_CODE');
  }

  const resetAuthorization = generateToken();
  const resetAuthorizationHash = hashToken(resetAuthorization);
  const verificationExpiresAt = new Date(Date.now() + PASSWORD_RESET_CODE_TTL * 1000);
  await repo.updatePasswordResetToken(resetRecord.id, {
    tokenHash: resetAuthorizationHash,
    codeHash: null,
    attempts: 0,
    verifiedAt: new Date(),
    expiresAt: verificationExpiresAt,
  });

  return { success: true, resetToken: resetAuthorization };
}

export async function resetPassword(input: string | { token?: string; password?: string; confirmPassword?: string; newPassword?: string; email?: string; ip?: string }, newPassword?: string, ipOverride?: string) {
  const normalizedInput = typeof input === 'string'
    ? { token: input, password: newPassword ?? '', confirmPassword: newPassword ?? '', ip: ipOverride ?? '127.0.0.1' }
    : input;

  const token = normalizedInput.token ?? '';
  const password = normalizedInput.password ?? normalizedInput.newPassword ?? '';
  const confirmPassword = normalizedInput.confirmPassword ?? (normalizedInput.password === normalizedInput.newPassword ? normalizedInput.newPassword ?? '' : '');
  const ip = normalizedInput.ip ?? '127.0.0.1';

  await enforceRateLimit({ ip, keyPrefix: 'reset-password', maxAttempts: 10, windowSeconds: 60 * 15 });

  if (!token && !normalizedInput.password && !normalizedInput.newPassword) throw new Error('INVALID_TOKEN');

  const resetToken = await repo.findPasswordResetTokenByTokenHash(hashToken(token));
  if (!resetToken) throw new Error('INVALID_TOKEN');
  if (resetToken.used) throw new Error('TOKEN_ALREADY_USED');
  if (resetToken.expiresAt.getTime() < Date.now()) throw new Error('TOKEN_EXPIRED');
  if (!resetToken.verifiedAt) throw new Error('INVALID_TOKEN');

  const user = await repo.findUserById(resetToken.userId);
  if (!user) throw new Error('USER_NOT_FOUND');

  if (password !== confirmPassword) throw new Error('PASSWORD_MISMATCH');
  if (password.length < 8) throw new Error('PASSWORD_TOO_SHORT');

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const claimed = await repo.claimPasswordResetToken(resetToken.id);
  if (claimed.count === 0) {
    throw new Error(resetToken.used ? 'TOKEN_ALREADY_USED' : 'TOKEN_EXPIRED');
  }

  const [, primaryOrganizationId] = await Promise.all([
    Promise.all([
      repo.updateUserPassword(user.id, passwordHash),
      repo.revokeAllSessionsByUserId(user.id),
    ]),
    getPrimaryOrganizationId(user.id),
  ]);

  if (primaryOrganizationId) {
    dispatchNotification({
      type: 'PASSWORD_RESET',
      title: 'Password reset',
      body: 'Your LearnFlow password was reset successfully.',
      data: { organizationName: primaryOrganizationId },
      userId: user.id,
      organizationId: primaryOrganizationId,
      email: { name: user.name },
    }).catch((err) => {
      console.error('Failed to dispatch password reset notification:', err);
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
  const normalizedEmail = normalizeEmail(normalizedInput.email);
  if (!normalizedEmail) throw new Error('INVALID_EMAIL');
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

  // OPTIMIZATION: Queue email sending to background job (fire-and-forget)
  if (isEmailQueueEnabled()) {
    getEmailQueue()
      .add('send-verification-email', {
        type: 'verification',
        email: normalizedEmail,
        token: verificationToken,
      })
      .catch((err) => {
        console.error('Failed to queue verification email:', err);
      });
  } else {
    // Fallback: send without blocking
    sendVerificationEmail(normalizedEmail, verificationToken).catch((err) => {
      console.error('Failed to send verification email:', err);
    });
  }

  return { success: true };
}

export async function updateUserEmail({ userId, email, ip = '127.0.0.1' }: { userId: string; email: string; ip?: string }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('INVALID_EMAIL');
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
  await repo.createEmailVerificationToken({
    userId,
    tokenHash: verificationTokenHash,
    expiresAt: verificationExpiresAt,
  });

  if (isEmailQueueEnabled()) {
    getEmailQueue()
      .add('send-verification-email', {
        type: 'verification',
        email: normalizedEmail,
        token: verificationToken,
      })
      .catch((err) => {
        console.error('Failed to queue email-change verification email:', err);
      });
  } else {
    sendVerificationEmail(normalizedEmail, verificationToken).catch((err) => {
      console.error('Failed to send email-change verification email:', err);
    });
  }

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
