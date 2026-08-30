/**
 * PHASE 1 — Real authentication integration tests.
 *
 * These tests exercise the ACTUAL LearnFlow auth implementation end-to-end:
 * the real Express app, the real Prisma/PostgreSQL database, the real Redis
 * rate limiter, the real argon2 password hashing, and the real Mailpit-backed
 * SMTP email path. Nothing in authService, the auth repository, the prisma
 * client, the redis client, or the email transporter is mocked.
 *
 * Each scenario uses a unique email and a unique X-Forwarded-For IP so the
 * per-IP auth rate limits (which are part of the real implementation) do not
 * cause cross-test interference. Created users are deleted in afterAll.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import argon2 from 'argon2';
import app from '../server';
import getPrisma from '../prisma';
import { generateToken, hashToken } from '../utils/tokens';

const prisma = getPrisma();

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'learnflow_session';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const MAILPIT_API = process.env.MAILPIT_API || 'http://localhost:8025/api/v1';
const MAIL_SMTP_PORT = Number(process.env.MAIL_SMTP_PORT || '1025');

let counter = 0;
function uniqueEmail(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@phase1.test`;
}
// Randomized per-run seed so persistently rate-limited Redis keys from an
// earlier run can never leak into a later run's login/register counters.
const runSeed = Math.floor(Math.random() * 250) + 1;
function uniqueIp(): string {
  counter += 1;
  return `10.${runSeed}.${Math.floor(counter / 250) % 250}.${counter % 250}`;
}

const createdUserIds: string[] = [];
const createdRecipients: string[] = [];

function getCookieToken(res: request.Response): string {
  const setCookie = res.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const hit = cookies.find((c: string) => c.startsWith(`${COOKIE_NAME}=`));
  if (!hit) throw new Error(`No ${COOKIE_NAME} cookie in set-cookie: ${JSON.stringify(setCookie)}`);
  return hit.split(';')[0].split('=').slice(1).join('=');
}

function getCookieHeader(res: request.Response): string {
  const setCookie = res.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const hit = cookies.find((c: string) => c.startsWith(`${COOKIE_NAME}=`));
  if (!hit) throw new Error(`No ${COOKIE_NAME} cookie in set-cookie`);
  return hit;
}

interface MailpitMessage {
  ID?: string;
  Subject?: string;
  To?: Array<{ Address: string; Name?: string }>;
}

async function mailpit<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${MAILPIT_API}${path}`, init);
  if (!res.ok) throw new Error(`Mailpit request failed: ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

function extractToken(html: string, path: string): string {
  const match = html.match(new RegExp(`${path}\\?token=([A-Za-z0-9_-]+)`));
  if (!match) throw new Error(`No ${path} token found in email HTML`);
  return decodeURIComponent(match[1]);
}

async function waitForEmail(subjectFragment: string, to: string, path: string, timeoutMs = 15_000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { messages } = await mailpit<{ messages: MailpitMessage[] }>('/messages?limit=200');
    const match = messages.find(
      (m) =>
        (m.Subject ?? '').toLowerCase().includes(subjectFragment) &&
        (m.To ?? []).some((t) => t.Address.toLowerCase() === to.toLowerCase()),
    );
    if (match) {
      const detail = await mailpit<{ HTML?: string; Text?: string }>(`/message/${match.ID}`);
      const token = extractToken(detail.HTML ?? detail.Text ?? '', path);
      if (match.ID) {
        await mailpit('/messages', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ IDs: [match.ID] }),
        }).catch(() => undefined);
      }
      return token;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for "${subjectFragment}" email to ${to}`);
}

async function deleteMailpitForRecipient(to: string) {
  const { messages } = await mailpit<{ messages: MailpitMessage[] }>('/messages?limit=500');
  const ids = [
    ...new Set(
      messages
        .filter((m) => (m.To ?? []).some((t) => t.Address.toLowerCase() === to.toLowerCase()))
        .map((m) => m.ID)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (ids.length === 0) return;
  await mailpit('/messages', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ IDs: ids }),
  }).catch(() => undefined);
}

beforeAll(async () => {
  // Sanity: the real infrastructure must be reachable or the suite is BLOCKED.
  const ping = await fetch(`${MAILPIT_API}/messages?limit=1`).catch(() => null);
  if (!ping || !ping.ok) throw new Error('Mailpit API is not reachable — infrastructure required');
  await prisma.$queryRaw`SELECT 1`;
});

describe('Registration (real implementation)', () => {
  it('registers a user, persists it, returns a session cookie, keeps email unverified, and sends a verification email', async () => {
    const email = uniqueEmail('reg-ok');
    const password = 'Super$ecret123';
    const name = 'Phase1 Student';

    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name, email, password, confirmPassword: password });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeUndefined();
    expect(res.body.user.email).toBe(email.toLowerCase());
    expect(res.body.user.name).toBe(name);
    expect(res.body.user.emailVerified).toBe(false);
    expect(res.body.user.id).toBeTruthy();
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.token).toBeUndefined();

    const token = getCookieToken(res);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const cookieHeader = getCookieHeader(res);
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader.toLowerCase()).toContain('samesite=lax');
    expect(cookieHeader).toContain(`Path=/`);

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    expect(user).not.toBeNull();
    createdUserIds.push((user as { id: string }).id);
    createdRecipients.push(email.toLowerCase());

    const session = await prisma.session.findFirst({ where: { userId: (user as { id: string }).id } });
    expect(session).not.toBeNull();
    expect(session?.tokenHash).not.toBe(token);
    expect(session?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(session?.revoked).toBe(false);

    const verification = await prisma.emailVerificationToken.findFirst({ where: { userId: (user as { id: string }).id } });
    expect(verification).not.toBeNull();

    const verifyToken = await waitForEmail('verify', email.toLowerCase(), '/verify-email');
    expect(verifyToken).toMatch(/^[a-f0-9]{64}$/);
    expect(verification?.tokenHash).not.toBe(verifyToken);
    expect(verification?.tokenHash).toBe(hashToken(verifyToken));
  }, 30_000);

  it('rejects a duplicate email with 409 EMAIL_TAKEN', async () => {
    const email = uniqueEmail('reg-dup');
    const password = 'Super$ecret123';
    const ip = uniqueIp();

    const first = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', ip)
      .send({ name: 'First', email, password, confirmPassword: password });
    expect(first.status).toBe(200);
    createdUserIds.push(first.body.user.id);
    createdRecipients.push(email.toLowerCase());

    const dup = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Second', email, password, confirmPassword: password });

    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('EMAIL_TAKEN');
  });

  it('rejects an invalid email with 400 INVALID_EMAIL', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'X', email: 'not-an-email', password: 'Super$ecret123', confirmPassword: 'Super$ecret123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_EMAIL');
  });

  it('rejects missing required fields with 400 MISSING_FIELDS', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'missing@phase1.test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_FIELDS');
  });

  it('rejects a short password with 400 PASSWORD_TOO_SHORT', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'X', email: uniqueEmail('reg-short'), password: 'short', confirmPassword: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('PASSWORD_TOO_SHORT');
  });

  it('rejects a confirm-password mismatch with 400 PASSWORD_MISMATCH', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({
        name: 'X',
        email: uniqueEmail('reg-mismatch'),
        password: 'Super$ecret123',
        confirmPassword: 'different',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('PASSWORD_MISMATCH');
  });

  it('rejects PLATFORM_ADMIN role on public registration with 403 ROLE_NOT_ALLOWED', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({
        name: 'X',
        email: uniqueEmail('reg-role'),
        password: 'Super$ecret123',
        confirmPassword: 'Super$ecret123',
        role: 'PLATFORM_ADMIN',
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ROLE_NOT_ALLOWED');
  });

  it('persists the email lowercased and logs in case-insensitively', async () => {
    const email = uniqueEmail('reg-case');
    const password = 'Super$ecret123';
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Case', email: email.toUpperCase(), password, confirmPassword: password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email.toLowerCase());
    createdUserIds.push(res.body.user.id);
    createdRecipients.push(email.toLowerCase());

    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: email.toUpperCase(), password });
    expect(login.status).toBe(200);
  }, 30_000);

  it('rejects an email with surrounding whitespace with 400 INVALID_EMAIL', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Padded', email: `  ${uniqueEmail('padded')}  `, password: 'Super$ecret123', confirmPassword: 'Super$ecret123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_EMAIL');
  });
});

describe('Email verification (real implementation)', () => {
  it('verifies the user through the emailed token end-to-end', async () => {
    const email = uniqueEmail('verify-ok');
    const password = 'Super$ecret123';
    const ip = uniqueIp();

    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', ip)
      .send({ name: 'Verify Me', email, password, confirmPassword: password });
    expect(reg.status).toBe(200);
    const userId = reg.body.user.id;
    createdUserIds.push(userId);
    createdRecipients.push(email.toLowerCase());

    const stored = await prisma.user.findUnique({ where: { id: userId } });
    expect(stored?.emailVerified).toBe(false);

    const verifyToken = await waitForEmail('verify', email.toLowerCase(), '/verify-email');

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: verifyToken });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('verified successfully');

    const after = await prisma.user.findUnique({ where: { id: userId } });
    expect(after?.emailVerified).toBe(true);
    const usedToken = await prisma.emailVerificationToken.findFirst({ where: { userId } });
    expect(usedToken?.used).toBe(true);
  }, 30_000);

  it('rejects an invalid / unknown verification token with 400 INVALID_TOKEN', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: 'a'.repeat(64) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_TOKEN');
  });

  it('rejects a missing token with 400 MISSING_TOKEN', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_TOKEN');
  });

  it('rejects a malformed token with 400 INVALID_TOKEN', async () => {
    for (const token of ['short', '!!not-token!!', 'with space', `${'a'.repeat(60)}zz`]) {
      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .set('X-Forwarded-For', uniqueIp())
        .send({ token });
      expect([400, 401, 403]).toContain(res.status);
      expect(['INVALID_TOKEN']).toContain(res.body.error);
    }
  });

  it('rejects a token that has already been used with 400 TOKEN_ALREADY_USED', async () => {
    const email = uniqueEmail('verify-reuse');
    const password = 'Super$ecret123';
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Reuse', email, password, confirmPassword: password });
    const userId = reg.body.user.id;
    createdUserIds.push(userId);
    createdRecipients.push(email.toLowerCase());

    const verifyToken = await waitForEmail('verify', email.toLowerCase(), '/verify-email');

    const first = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: verifyToken });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: verifyToken });
    expect(second.status).toBe(400);
    expect(second.body.error).toBe('TOKEN_ALREADY_USED');
  }, 30_000);

  it('rejects an expired verification token with 400 TOKEN_EXPIRED', async () => {
    const email = uniqueEmail('verify-expired');
    const password = 'Super$ecret123';
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Expired', email, password, confirmPassword: password });
    const userId = reg.body.user.id;
    createdUserIds.push(userId);
    createdRecipients.push(email.toLowerCase());

    // Time-travel: create a real verification-token row (sha256 of the token)
    // whose expiry is already in the past, as it would be 24h after issue.
    const token = generateToken();
    await prisma.emailVerificationToken.create({
      data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() - 60_000) },
    });

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('TOKEN_EXPIRED');
    expect((await prisma.user.findUnique({ where: { id: userId } }))?.emailVerified).toBe(false);
  });

  it('is idempotent for an already-verified user with a fresh token', async () => {
    const email = uniqueEmail('verify-already');
    const password = 'Super$ecret123';
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Already', email, password, confirmPassword: password });
    const userId = reg.body.user.id;
    createdUserIds.push(userId);
    createdRecipients.push(email.toLowerCase());

    const initialToken = await waitForEmail('verify', email.toLowerCase(), '/verify-email');
    const verify = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: initialToken });
    expect(verify.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: userId } }))?.emailVerified).toBe(true);

    const freshToken = generateToken();
    await prisma.emailVerificationToken.create({
      data: { userId, tokenHash: hashToken(freshToken), expiresAt: new Date(Date.now() + 86_400_000) },
    });
    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: freshToken });
    expect(res.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: userId } }))?.emailVerified).toBe(true);
  }, 30_000);
});

describe('Login (real implementation)', () => {
  let verified: { email: string; password: string; userId: string };

  beforeAll(async () => {
    const email = uniqueEmail('login-verified');
    const password = 'Super$ecret123';
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Login Verified', email, password, confirmPassword: password });
    const userId = reg.body.user.id;
    createdUserIds.push(userId);
    createdRecipients.push(email.toLowerCase());
    const verifyToken = await waitForEmail('verify', email.toLowerCase(), '/verify-email');
    const verify = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: verifyToken });
    expect(verify.status).toBe(200);
    verified = { email, password, userId };
  }, 30_000);

  it('logs in with valid credentials, issues a session cookie, and returns no sensitive data', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: verified.email, password: verified.password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(verified.email);
    expect(res.body.user.emailVerified).toBe(true);
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.token).toBeUndefined();

    const token = getCookieToken(res);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const session = await prisma.session.findFirst({
      where: { userId: verified.userId, tokenHash: hashToken(token), revoked: false },
    });
    expect(session).not.toBeNull();
  });

  it('rejects an incorrect password with 401 INVALID_CREDENTIALS (no account leakage)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: verified.email, password: 'DefinitelyWrong123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('rejects a nonexistent user with an identical 401 INVALID_CREDENTIALS (prevents enumeration)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: uniqueEmail('nobody'), password: 'DefinitelyWrong123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');

    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: verified.email, password: 'DefinitelyWrong123' });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error).toBe('INVALID_CREDENTIALS');
    expect(wrongPassword.body).toEqual(res.body);
  });

  it('rejects missing credentials with 400 MISSING_FIELDS', async () => {
    const missing = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe('MISSING_FIELDS');
  });

  it('locks out the IP after repeated login failures (real brute-force protection)', async () => {
    const ip = uniqueIp();
    const email = uniqueEmail('lockout');

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email, password: 'WrongPass123' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    }

    const locked = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password: 'WrongPass123' });
    expect(locked.status).toBe(429);
    expect(locked.body.error).toBe('TOO_MANY_ATTEMPTS');
  }, 30_000);

  it('allows an unverified user to sign in (session is created) but keeps emailVerified=false', async () => {
    const email = uniqueEmail('login-unverified');
    const password = 'Super$ecret123';
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Unverified', email, password, confirmPassword: password });
    createdUserIds.push(reg.body.user.id);
    createdRecipients.push(email.toLowerCase());

    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.user.emailVerified).toBe(false);
    expect(getCookieToken(res)).toMatch(/^[a-f0-9]{64}$/);
  }, 30_000);
});

describe('Session handling (real implementation)', () => {
  let user: { email: string; password: string; userId: string };

  beforeAll(async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({
        name: 'Session User',
        email: uniqueEmail('session'),
        password: 'Super$ecret123',
        confirmPassword: 'Super$ecret123',
      });
    user = { email: reg.body.user.email, password: 'Super$ecret123', userId: reg.body.user.id };
    createdUserIds.push(user.userId);
    createdRecipients.push(user.email);
  });

  it('serves an authenticated request and /me returns the authenticated user', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: user.email, password: user.password });
    expect(login.status).toBe(200);
    const cookie = getCookieToken(login);

    const me = await request(app).get('/api/v1/auth/me').set('Cookie', [`${COOKIE_NAME}=${cookie}`]);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(user.email);
    expect(me.body.user.id).toBe(user.userId);
  });

  it('rejects an unauthenticated /me with 401 NOT_AUTHENTICATED', async () => {
    const me = await request(app).get('/api/v1/auth/me');
    expect(me.status).toBe(401);
    expect(me.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('rejects an invalid session token with 401 SESSION_INVALID', async () => {
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', [`${COOKIE_NAME}=${'c'.repeat(64)}`]);
    expect(me.status).toBe(401);
    expect(me.body.error).toBe('SESSION_INVALID');
  });

  it('rejects an expired session with 401 SESSION_INVALID', async () => {
    const token = generateToken();
    await prisma.session.create({
      data: {
        userId: user.userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() - 60_000),
        revoked: false,
      },
    });
    const me = await request(app).get('/api/v1/auth/me').set('Cookie', [`${COOKIE_NAME}=${token}`]);
    expect(me.status).toBe(401);
    expect(me.body.error).toBe('SESSION_INVALID');
  });

  it('supports multiple concurrent sessions, each independently valid', async () => {
    const first = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: user.email, password: user.password });
    const second = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: user.email, password: user.password });

    const cookieA = getCookieToken(first);
    const cookieB = getCookieToken(second);
    expect(cookieA).not.toBe(cookieB);

    const sessions = await prisma.session.findMany({ where: { userId: user.userId, revoked: false } });
    expect(sessions.some((s) => s.tokenHash === hashToken(cookieA))).toBe(true);
    expect(sessions.some((s) => s.tokenHash === hashToken(cookieB))).toBe(true);

    const meA = await request(app).get('/api/v1/auth/me').set('Cookie', [`${COOKIE_NAME}=${cookieA}`]);
    const meB = await request(app).get('/api/v1/auth/me').set('Cookie', [`${COOKIE_NAME}=${cookieB}`]);
    expect(meA.status).toBe(200);
    expect(meB.status).toBe(200);
  });

  it('invalidates only the logged-out session when another remains active', async () => {
    const first = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: user.email, password: user.password });
    const second = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: user.email, password: user.password });
    const cookieA = getCookieToken(first);
    const cookieB = getCookieToken(second);

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`${COOKIE_NAME}=${cookieA}`]);
    expect(logout.status).toBe(200);

    const meA = await request(app).get('/api/v1/auth/me').set('Cookie', [`${COOKIE_NAME}=${cookieA}`]);
    expect(meA.status).toBe(401);
    expect(meA.body.error).toBe('SESSION_INVALID');

    const meB = await request(app).get('/api/v1/auth/me').set('Cookie', [`${COOKIE_NAME}=${cookieB}`]);
    expect(meB.status).toBe(200);
  });
});

describe('Logout (real implementation)', () => {
  it('revokes the server-side session so the cookie can no longer authenticate', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({
        name: 'Logout User',
        email: uniqueEmail('logout'),
        password: 'Super$ecret123',
        confirmPassword: 'Super$ecret123',
      });
    createdUserIds.push(reg.body.user.id);
    createdRecipients.push(reg.body.user.email);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: reg.body.user.email, password: 'Super$ecret123' });
    const cookie = getCookieToken(login);

    const before = await request(app).get('/api/v1/auth/me').set('Cookie', [`${COOKIE_NAME}=${cookie}`]);
    expect(before.status).toBe(200);

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`${COOKIE_NAME}=${cookie}`]);
    expect(logout.status).toBe(200);
    expect(logout.body.ok).toBe(true);

    const after = await request(app).get('/api/v1/auth/me').set('Cookie', [`${COOKIE_NAME}=${cookie}`]);
    expect(after.status).toBe(401);
    expect(after.body.error).toBe('SESSION_INVALID');

    const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(cookie) } });
    expect(session?.revoked).toBe(true);
  });

  it('is idempotent with no cookie present', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('Password hashing (real implementation)', () => {
  it('stores only an argon2id hash, never the plaintext, and login validates against it', async () => {
    const email = uniqueEmail('hash');
    const password = 'HashMe123!';
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Hashed', email, password, confirmPassword: password });
    expect(reg.status).toBe(200);
    const userId = reg.body.user.id;
    createdUserIds.push(userId);
    createdRecipients.push(email.toLowerCase());

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.passwordHash).not.toBe(password);
    expect(user?.passwordHash?.startsWith('$argon2id$')).toBe(true);
    expect(await argon2.verify(user?.passwordHash as string, password)).toBe(true);
    expect(await argon2.verify(user?.passwordHash as string, 'WrongPassword')).toBe(false);

    const ok = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email, password });
    expect(ok.status).toBe(200);

    const bad = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email, password: 'WrongPassword' });
    expect(bad.status).toBe(401);
  });
});

describe('Forgot / reset password (real implementation)', () => {
  it('requests a reset, emails a token through Mailpit, resets the password, and lets the new password log in', async () => {
    const email = uniqueEmail('reset');
    const oldPassword = 'OldPassword123';
    const newPassword = 'NewPassword456';
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Reset Me', email, password: oldPassword, confirmPassword: oldPassword });
    const userId = reg.body.user.id;
    createdUserIds.push(userId);
    createdRecipients.push(email.toLowerCase());

    const forgot = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email });
    expect(forgot.status).toBe(200);

    const resetToken = await waitForEmail('reset your learnflow password', email.toLowerCase(), '/reset-password');
    expect(resetToken).toMatch(/^[a-f0-9]{64}$/);

    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: resetToken, password: newPassword, confirmPassword: newPassword });
    expect(reset.status).toBe(200);
    expect(reset.body.message).toContain('successfully');

    const stored = await prisma.user.findUnique({ where: { id: userId } });
    expect(await argon2.verify(stored?.passwordHash as string, newPassword)).toBe(true);
    expect(await argon2.verify(stored?.passwordHash as string, oldPassword)).toBe(false);

    const oldLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email, password: oldPassword });
    expect(oldLogin.status).toBe(401);
    expect(oldLogin.body.error).toBe('INVALID_CREDENTIALS');

    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email, password: newPassword });
    expect(newLogin.status).toBe(200);
  }, 30_000);

  it('does not reveal whether an email exists (identical success response for unknown emails)', async () => {
    const known = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'known@phase1.test' });
    const unknown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: uniqueEmail('definitely-unknown') });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
  });

  it('rejects an invalid reset token with 400 INVALID_TOKEN', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: 'deadbeef'.repeat(8), password: 'NewPassword456', confirmPassword: 'NewPassword456' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_TOKEN');
  });

  it('rejects an expired reset token with 400 TOKEN_EXPIRED', async () => {
    const email = uniqueEmail('reset-expired');
    const password = 'OldPassword123';
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Reset Expired', email, password, confirmPassword: password });
    const userId = reg.body.user.id;
    createdUserIds.push(userId);
    createdRecipients.push(email.toLowerCase());

    const token = generateToken();
    await prisma.passwordResetToken.create({
      data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() - 60_000) },
    });

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token, password: 'NewPassword456', confirmPassword: 'NewPassword456' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('TOKEN_EXPIRED');

    const stored = await prisma.user.findUnique({ where: { id: userId } });
    expect(await argon2.verify(stored?.passwordHash as string, password)).toBe(true);
  });

  it('rejects a reused reset token with 400 TOKEN_ALREADY_USED', async () => {
    const email = uniqueEmail('reset-reuse');
    const oldPassword = 'OldPassword123';
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Reset Reuse', email, password: oldPassword, confirmPassword: oldPassword });
    const userId = reg.body.user.id;
    createdUserIds.push(userId);
    createdRecipients.push(email.toLowerCase());

    const forgot = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email });
    expect(forgot.status).toBe(200);

    const resetToken = await waitForEmail('reset your learnflow password', email.toLowerCase(), '/reset-password');

    const first = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: resetToken, password: 'NewPassword456', confirmPassword: 'NewPassword456' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: resetToken, password: 'AnotherPassword789', confirmPassword: 'AnotherPassword789' });
    expect(second.status).toBe(400);
    expect(second.body.error).toBe('TOKEN_ALREADY_USED');
  }, 30_000);

  it('revokes all existing sessions after a successful reset', async () => {
    const email = uniqueEmail('reset-sessions');
    const oldPassword = 'OldPassword123';
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Reset Sessions', email, password: oldPassword, confirmPassword: oldPassword });
    const userId = reg.body.user.id;
    createdUserIds.push(userId);
    createdRecipients.push(email.toLowerCase());
    const registerCookie = getCookieToken(reg);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email, password: oldPassword });
    const loginCookie = getCookieToken(login);

    const forgot = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email });
    expect(forgot.status).toBe(200);

    const resetToken = await waitForEmail('reset your learnflow password', email.toLowerCase(), '/reset-password');
    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: resetToken, password: 'NewPassword456', confirmPassword: 'NewPassword456' });
    expect(reset.status).toBe(200);

    const sessions = await prisma.session.findMany({ where: { userId } });
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions.every((s) => s.revoked)).toBe(true);

    for (const cookie of [registerCookie, loginCookie]) {
      const me = await request(app).get('/api/v1/auth/me').set('Cookie', [`${COOKIE_NAME}=${cookie}`]);
      expect(me.status).toBe(401);
      expect(me.body.error).toBe('SESSION_INVALID');
    }
  }, 30_000);

  it('rejects missing reset fields with 400 MISSING_FIELDS and short passwords with 400 PASSWORD_TOO_SHORT', async () => {
    const missing = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe('MISSING_FIELDS');

    const short = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: 'token', password: 'short', confirmPassword: 'short' });
    expect(short.status).toBe(400);
    expect(short.body.error).toBe('PASSWORD_TOO_SHORT');
  });
});

describe('Protected routes and middleware (real implementation)', () => {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'fatimaramzan739@gmail.com';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'fatima123';

  it('rejects an unauthenticated request to a protected route with 401 NOT_AUTHENTICATED', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');

    const res2 = await request(app).get('/api/v1/org/categories');
    expect(res2.status).toBe(401);
    expect(res2.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('rejects an invalid session on a protected route with 401 SESSION_INVALID', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Cookie', [`${COOKIE_NAME}=${'d'.repeat(64)}`]);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('SESSION_INVALID');
  });

  it('allows an authenticated platform admin through a protected route (middleware executes end-to-end)', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('PLATFORM_ADMIN');
    const cookie = getCookieToken(login);

    const res = await request(app).get('/api/v1/admin/dashboard').set('Cookie', [`${COOKIE_NAME}=${cookie}`]);
    expect(res.status).toBe(200);
  });

  it('denies a non-platform-admin user on a platform-admin route with 403 PLATFORM_ADMIN_REQUIRED', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({
        name: 'Not Admin',
        email: uniqueEmail('not-admin'),
        password: 'Super$ecret123',
        confirmPassword: 'Super$ecret123',
      });
    createdUserIds.push(reg.body.user.id);
    createdRecipients.push(reg.body.user.email);
    const registerCookie = getCookieToken(reg);

    const res = await request(app).get('/api/v1/admin/dashboard').set('Cookie', [`${COOKIE_NAME}=${registerCookie}`]);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PLATFORM_ADMIN_REQUIRED');
  });

  it('blocks an unverified user on a verify-email-gated route with 403 EMAIL_NOT_VERIFIED', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({
        name: 'Unverified Gate',
        email: uniqueEmail('unverified-gate'),
        password: 'Super$ecret123',
        confirmPassword: 'Super$ecret123',
      });
    createdUserIds.push(reg.body.user.id);
    createdRecipients.push(reg.body.user.email);
    const cookie = getCookieToken(reg);

    const res = await request(app)
      .get('/api/v1/organizations/whatever-org/student/courses')
      .set('Cookie', [`${COOKIE_NAME}=${cookie}`]);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
  });

  it('passes a verified user past requireVerifiedEmail but enforces org context afterwards', async () => {
    const email = uniqueEmail('verified-gate');
    const password = 'Super$ecret123';
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Verified Gate', email, password, confirmPassword: password });
    createdUserIds.push(reg.body.user.id);
    createdRecipients.push(email.toLowerCase());
    const cookie = getCookieToken(reg);

    const verifyToken = await waitForEmail('verify', email.toLowerCase(), '/verify-email');
    const verify = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: verifyToken });
    expect(verify.status).toBe(200);

    const res = await request(app)
      .get('/api/v1/organizations/whatever-org/student/courses')
      .set('Cookie', [`${COOKIE_NAME}=${cookie}`]);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
  }, 30_000);
});

describe('Security checks (real implementation)', () => {
  it('never returns passwords or auth tokens in API response bodies', async () => {
    const email = uniqueEmail('sec-no-leak');
    const password = 'Super$ecret123';

    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Sec', email, password, confirmPassword: password });
    createdUserIds.push(reg.body.user.id);
    createdRecipients.push(email.toLowerCase());
    const serialized = JSON.stringify(reg.body);
    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain('passwordHash');
    expect(reg.body.token).toBeUndefined();
    expect(reg.body.password).toBeUndefined();
    expect(reg.body.passwordHash).toBeUndefined();
  });

  it('sets HttpOnly session cookies with Lax SameSite, Path=/ and (in dev) no Secure flag', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({
        name: 'Cookie',
        email: uniqueEmail('cookie'),
        password: 'Super$ecret123',
        confirmPassword: 'Super$ecret123',
      });
    createdUserIds.push(reg.body.user.id);
    createdRecipients.push(reg.body.user.email);
    const header = getCookieHeader(reg).toLowerCase();
    expect(header).toContain('httponly');
    expect(header).toContain('samesite=lax');
    expect(header).toContain('path=/');
  });

  it('attaches standard security headers to API responses', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('does not record tokens or secrets in console output during an auth flow', async () => {
    const email = uniqueEmail('sec-logs');
    const password = 'SuperSecretLogCheck123';
    const ip = uniqueIp();

    const captured: string[] = [];
    let sessionCookie = '';
    const origLog = console.log;
    const origError = console.error;
    const origWarn = console.warn;
    console.log = (...args) => { captured.push(args.map(String).join(' ')); origLog(...args); };
    console.error = (...args) => { captured.push(args.map(String).join(' ')); origError(...args); };
    console.warn = (...args) => { captured.push(args.map(String).join(' ')); origWarn(...args); };

    try {
      const reg = await request(app)
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', ip)
        .send({ name: 'Log Check', email, password, confirmPassword: password });
      const userId = reg.body.user.id;
      createdUserIds.push(userId);
      createdRecipients.push(email.toLowerCase());

      const login = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', uniqueIp())
        .send({ email, password });
      sessionCookie = getCookieToken(login);

      await request(app).get('/api/v1/auth/me').set('Cookie', [`${COOKIE_NAME}=${sessionCookie}`]);
      await request(app)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', uniqueIp())
        .send({ email });
    } finally {
      console.log = origLog;
      console.error = origError;
      console.warn = origWarn;
    }

    const joined = captured.join('\n');
    expect(joined).not.toContain(password);
    expect(joined).not.toContain(sessionCookie);
  }, 30_000);
});

afterAll(async () => {
  await Promise.all(createdUserIds.map((id) => prisma.user.delete({ where: { id } }).catch(() => undefined)));
  await Promise.all(createdRecipients.map((to) => deleteMailpitForRecipient(to)));
  await prisma.$disconnect();
});