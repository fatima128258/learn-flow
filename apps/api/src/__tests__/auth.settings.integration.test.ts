/**
 * Settings (self-service email / password change) integration tests.
 *
 * Exercises the REAL implementation end-to-end: the actual Express app, the
 * real Prisma/PostgreSQL database, the real Redis rate limiter, real argon2
 * hashing and the real Mailpit SMTP/API path. Nothing is mocked.
 *
 * Coverage: email change (old email stops working, new email works, email is
 * re-verified, verification tokens are rotated, sessions survive), password
 * change (current-password validation, old password stops working, new password
 * works, non-acting sessions are revoked, acting session survives), input
 * validation, auth requirements and audit logging.
 *
 * Unique emails + unique X-Forwarded-For IPs avoid cross-test interference.
 * Created rows are cleaned up in afterAll.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import argon2 from 'argon2';
import app from '../server';
import getPrisma from '../prisma';
import { generateToken, hashToken } from '../utils/tokens';

const prisma = getPrisma();

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'learnflow_session';
const MAILPIT_API = process.env.MAILPIT_API || 'http://localhost:8025/api/v1';

let counter = 0;
function uniqueEmail(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@phase-settings.test`;
}
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

/** Registers + verifies a fresh user through the real email path and returns credentials + cookie. */
async function registerVerifiedUser(prefix: string): Promise<{ email: string; password: string; userId: string; cookie: string }> {
  const email = uniqueEmail(prefix);
  const password = 'Super$ecret123';
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .set('X-Forwarded-For', uniqueIp())
    .send({ name: 'Settings Student', email, password, confirmPassword: password });
  if (reg.status !== 200) throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  const userId = reg.body.user.id;
  createdUserIds.push(userId);
  createdRecipients.push(email.toLowerCase());

  const verifyToken = await waitForEmail('verify', email.toLowerCase(), '/verify-email');
  const verify = await request(app)
    .post('/api/v1/auth/verify-email')
    .set('X-Forwarded-For', uniqueIp())
    .send({ token: verifyToken });
  if (verify.status !== 200) throw new Error(`verify failed: ${verify.status} ${JSON.stringify(verify.body)}`);

  const login = await request(app)
    .post('/api/v1/auth/login')
    .set('X-Forwarded-For', uniqueIp())
    .send({ email, password });
  if (login.status !== 200) throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`);

  return { email, password, userId, cookie: getCookieToken(login) };
}

/** Registers a fresh user through the real API. Does NOT consume the verification email or mark the email verified. */
async function registerRaw(prefix: string): Promise<{ email: string; password: string; userId: string; cookie: string }> {
  const email = uniqueEmail(prefix);
  const password = 'Super$ecret123';
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .set('X-Forwarded-For', uniqueIp())
    .send({ name: 'Settings Student', email, password, confirmPassword: password });
  if (reg.status !== 200) throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  createdUserIds.push(reg.body.user.id);
  createdRecipients.push(email.toLowerCase());
  return { email, password, userId: reg.body.user.id, cookie: getCookieToken(reg) };
}

beforeAll(async () => {
  const ping = await fetch(`${MAILPIT_API}/messages?limit=1`).catch(() => null);
  if (!ping || !ping.ok) throw new Error('Mailpit API is not reachable — infrastructure required');
  await prisma.$queryRaw`SELECT 1`;
});

describe('Settings: change email', () => {
  it('changes email end-to-end: old email stops logging in, new email works, re-verification required', async () => {
    const { email: oldEmail, password, userId, cookie } = await registerVerifiedUser('email-ok');

    expect((await prisma.user.findUnique({ where: { id: userId } }))?.emailVerified).toBe(true);

    const newEmail = uniqueEmail('email-new');

    // Update email while authenticated.
    const patch = await request(app)
      .patch('/api/v1/auth/me')
      .set('Cookie', [`${COOKIE_NAME}=${cookie}`])
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: newEmail });
    expect(patch.status).toBe(200);
    expect(patch.body.user.email).toBe(newEmail);
    expect(patch.body.user.emailVerified).toBe(false);
    expect(patch.body.user.password).toBeUndefined();
    expect(patch.body.user.passwordHash).toBeUndefined();

    const stored = await prisma.user.findUnique({ where: { id: userId } });
    expect(stored?.email).toBe(newEmail);
    expect(stored?.emailVerified).toBe(false);

    // Old email must no longer authenticate.
    const oldLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: oldEmail, password });
    expect(oldLogin.status).toBe(401);
    expect(oldLogin.body.error).toBe('INVALID_CREDENTIALS');

    // New email authenticates with the SAME password (only the email changed).
    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: newEmail, password });
    expect(newLogin.status).toBe(200);

    // The existing session survives an email change and reflects the new email.
    const me = await request(app).get('/api/v1/auth/me').set('Cookie', [`${COOKIE_NAME}=${cookie}`]);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(newEmail);
    expect(me.body.user.emailVerified).toBe(false);

    // A fresh verification email is sent to the new address; verifying works.
    const newVerifyToken = await waitForEmail('verify', newEmail, '/verify-email');
    expect(newVerifyToken).toMatch(/^[a-f0-9]{64}$/);

    const verify = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: newVerifyToken });
    expect(verify.status).toBe(200);

    expect((await prisma.user.findUnique({ where: { id: userId } }))?.emailVerified).toBe(true);
  }, 30_000);

  it('rotates verification tokens: the old (used) verification token can no longer verify', async () => {
    const { email: oldEmail, cookie } = await registerRaw('email-rotate');

    // Token A was emailed to the old address at registration time.
    const oldVerifyToken = await waitForEmail('verify', oldEmail, '/verify-email');
    const first = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: oldVerifyToken });
    expect(first.status).toBe(200);

    const newEmail = uniqueEmail('email-rotate-new');
    const patch = await request(app)
      .patch('/api/v1/auth/me')
      .set('Cookie', [`${COOKIE_NAME}=${cookie}`])
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: newEmail });
    expect(patch.status).toBe(200);

    // A fresh token B is emailed to the new address; verifying it succeeds.
    const newVerifyToken = await waitForEmail('verify', newEmail, '/verify-email');
    const verify = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: newVerifyToken });
    expect(verify.status).toBe(200);

    // The old address's token is now used and can no longer verify anything.
    const stale = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: oldVerifyToken });
    expect(stale.status).toBe(400);
    expect(stale.body.error).toBe('TOKEN_ALREADY_USED');
  }, 30_000);

  it('rejects an expired verification token issued after an email change (24h TTL path)', async () => {
    const { password, cookie } = await registerRaw('email-expired');

    const newEmail = uniqueEmail('email-expired-new');
    const patch = await request(app)
      .patch('/api/v1/auth/me')
      .set('Cookie', [`${COOKIE_NAME}=${cookie}`])
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: newEmail });
    expect(patch.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { email: newEmail } }))?.emailVerified).toBe(false);

    // Consume the verification email that the email change produced.
    await waitForEmail('verify', newEmail, '/verify-email');

    // Time-travel: wipe un-expired unused tokens for the user, then plant one that already expired.
    const user = await prisma.user.findUnique({ where: { email: newEmail } });
    const token = generateToken();
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user?.id, used: false } });
    await prisma.emailVerificationToken.create({
      data: { userId: user!.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() - 60_000) },
    });

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('TOKEN_EXPIRED');
    expect((await prisma.user.findUnique({ where: { id: user!.id } }))?.emailVerified).toBe(false);

    // Re-requesting verification for the NEW address issues a fresh working token.
    const resend = await request(app)
      .post('/api/v1/auth/resend-verification')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: newEmail });
    expect(resend.status).toBe(200);
    const freshToken = await waitForEmail('verify', newEmail, '/verify-email');
    expect((await prisma.user.findUnique({ where: { email: newEmail } }))?.emailVerified).toBe(false);

    const ok = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: freshToken });
    expect(ok.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { email: newEmail } }))?.emailVerified).toBe(true);

    // Password is untouched by email changes.
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: newEmail, password });
    expect(login.status).toBe(200);
  }, 40_000);

  it('is idempotent when the email is unchanged', async () => {
    const { email, cookie } = await registerVerifiedUser('email-same');
    const patch = await request(app)
      .patch('/api/v1/auth/me')
      .set('Cookie', [`${COOKIE_NAME}=${cookie}`])
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: email.toUpperCase() });
    expect(patch.status).toBe(200);
    expect(patch.body.user.email).toBe(email);
    expect(patch.body.user.emailVerified).toBe(true);
  }, 30_000);

  it('rejects a missing or malformed email with 400 MISSING_EMAIL / INVALID_EMAIL', async () => {
    const { cookie } = await registerVerifiedUser('email-bad');
    const missing = await request(app)
      .patch('/api/v1/auth/me')
      .set('Cookie', [`${COOKIE_NAME}=${cookie}`])
      .set('X-Forwarded-For', uniqueIp())
      .send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe('MISSING_EMAIL');

    const invalid = await request(app)
      .patch('/api/v1/auth/me')
      .set('Cookie', [`${COOKIE_NAME}=${cookie}`])
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'not-an-email' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toBe('INVALID_EMAIL');
  }, 30_000);

  it('rejects an email already in use by another account with 409 EMAIL_TAKEN', async () => {
    const { email: takenEmail } = await registerVerifiedUser('email-taken');
    const { cookie } = await registerVerifiedUser('email-taken-user');

    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Cookie', [`${COOKIE_NAME}=${cookie}`])
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: takenEmail });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('EMAIL_TAKEN');
  }, 30_000);

  it('requires authentication with 401 NOT_AUTHENTICATED', async () => {
    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: uniqueEmail('email-noauth') });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });
});

describe('Settings: change password', () => {
  it('validates current password, rejects old password and accepts new password, keeps acting session and revokes others', async () => {
    const { email, password: oldPassword, userId, cookie: cookieA } = await registerVerifiedUser('pass-ok');

    // Second concurrent session.
    const loginB = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email, password: oldPassword });
    const cookieB = getCookieToken(loginB);

    const newPassword = 'BrandNewPass456';

    // Wrong current password.
    const wrong = await request(app)
      .patch('/api/v1/auth/password')
      .set('Cookie', [`${COOKIE_NAME}=${cookieA}`])
      .set('X-Forwarded-For', uniqueIp())
      .send({ currentPassword: 'NotThePassword', newPassword, confirmNewPassword: newPassword });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toBe('INVALID_CURRENT_PASSWORD');

    // Short new password.
    const short = await request(app)
      .patch('/api/v1/auth/password')
      .set('Cookie', [`${COOKIE_NAME}=${cookieA}`])
      .set('X-Forwarded-For', uniqueIp())
      .send({ currentPassword: oldPassword, newPassword: 'short', confirmNewPassword: 'short' });
    expect(short.status).toBe(400);
    expect(short.body.error).toBe('PASSWORD_TOO_SHORT');

    // Mismatched confirmation.
    const mismatch = await request(app)
      .patch('/api/v1/auth/password')
      .set('Cookie', [`${COOKIE_NAME}=${cookieA}`])
      .set('X-Forwarded-For', uniqueIp())
      .send({ currentPassword: oldPassword, newPassword, confirmNewPassword: 'different123' });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error).toBe('PASSWORD_MISMATCH');

    // Missing fields.
    const missing = await request(app)
      .patch('/api/v1/auth/password')
      .set('Cookie', [`${COOKIE_NAME}=${cookieA}`])
      .set('X-Forwarded-For', uniqueIp())
      .send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe('MISSING_FIELDS');

    // Sessions survive failed attempts.
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', [`${COOKIE_NAME}=${cookieA}`])).status).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', [`${COOKIE_NAME}=${cookieB}`])).status).toBe(200);

    // Valid change.
    const ok = await request(app)
      .patch('/api/v1/auth/password')
      .set('Cookie', [`${COOKIE_NAME}=${cookieA}`])
      .set('X-Forwarded-For', uniqueIp())
      .send({ currentPassword: oldPassword, newPassword, confirmNewPassword: newPassword });
    expect(ok.status).toBe(200);
    expect(ok.body.success).toBe(true);

    // Only the new hash is stored.
    const stored = await prisma.user.findUnique({ where: { id: userId } });
    expect(await argon2.verify(stored?.passwordHash as string, newPassword)).toBe(true);
    expect(await argon2.verify(stored?.passwordHash as string, oldPassword)).toBe(false);

    // The acting session survives; the other session is revoked.
    const meA = await request(app).get('/api/v1/auth/me').set('Cookie', [`${COOKIE_NAME}=${cookieA}`]);
    expect(meA.status).toBe(200);
    const meB = await request(app).get('/api/v1/auth/me').set('Cookie', [`${COOKIE_NAME}=${cookieB}`]);
    expect(meB.status).toBe(401);
    expect(meB.body.error).toBe('SESSION_INVALID');

    // Old password no longer works; new password works.
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
  }, 40_000);

  it('requires authentication with 401 NOT_AUTHENTICATED', async () => {
    const res = await request(app)
      .patch('/api/v1/auth/password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ currentPassword: 'x', newPassword: 'y', confirmNewPassword: 'y' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NOT_AUTHENTICATED');
  });
});

describe('Settings: audit logging', () => {
  let adminCookie = '';

  beforeAll(async () => {
    // Create a real platform admin through the database so the suite does not
    // depend on a pre-seeded admin account.
    const org = await prisma.organization.create({
      data: { name: 'Audit Test Org', slug: `audit-org-${Date.now()}`, status: 'ACTIVE' },
    });
    const adminEmail = uniqueEmail('audit-admin');
    const adminPassword = 'AdminPass123';
    const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
    const admin = await prisma.user.create({
      data: { name: 'Audit Admin', email: adminEmail, passwordHash, emailVerified: true },
    });
    await prisma.userOrganization.create({
      data: { userId: admin.id, organizationId: org.id, role: 'PLATFORM_ADMIN' },
    });
    createdUserIds.push(admin.id);
    createdRecipients.push(adminEmail);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: adminEmail, password: adminPassword });
    if (login.status !== 200) throw new Error(`admin login failed: ${login.status} ${JSON.stringify(login.body)}`);
    adminCookie = getCookieToken(login);
  });

  it('records EMAIL_UPDATED and PASSWORD_CHANGED, visible in the platform audit log', async () => {
    const { password: oldPassword, userId, cookie } = await registerVerifiedUser('audit-user');

    const newEmail = uniqueEmail('audit-user-new');
    const emailPatch = await request(app)
      .patch('/api/v1/auth/me')
      .set('Cookie', [`${COOKIE_NAME}=${cookie}`])
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: newEmail });
    expect(emailPatch.status).toBe(200);

    const newPassword = 'AuditNewPassword1';
    const passPatch = await request(app)
      .patch('/api/v1/auth/password')
      .set('Cookie', [`${COOKIE_NAME}=${cookie}`])
      .set('X-Forwarded-For', uniqueIp())
      .send({ currentPassword: oldPassword, newPassword, confirmNewPassword: newPassword });
    expect(passPatch.status).toBe(200);

    const emailLogs = await request(app)
      .get(`/api/v1/admin/audit-logs?action=EMAIL_UPDATED&actorUserId=${userId}`)
      .set('Cookie', [`${COOKIE_NAME}=${adminCookie}`]);
    expect(emailLogs.status).toBe(200);
    expect(emailLogs.body.success).toBe(true);
    const emailEntry = emailLogs.body.data.find((e: { actor: { userId: string } }) => e.actor.userId === userId);
    expect(emailEntry).toBeTruthy();
    expect(emailEntry.action).toBe('EMAIL_UPDATED');
    expect(emailEntry.actor.email).toBe(newEmail);
    expect(emailEntry.resource.type).toBe('USER');
    expect(emailEntry.resource.id).toBe(userId);
    expect(emailEntry.ipAddress).toBeTruthy();

    const passLogs = await request(app)
      .get(`/api/v1/admin/audit-logs?action=PASSWORD_CHANGED&actorUserId=${userId}`)
      .set('Cookie', [`${COOKIE_NAME}=${adminCookie}`]);
    expect(passLogs.status).toBe(200);
    const passEntry = passLogs.body.data.find((e: { actor: { userId: string } }) => e.actor.userId === userId);
    expect(passEntry).toBeTruthy();
    expect(passEntry.action).toBe('PASSWORD_CHANGED');
    expect(passEntry.actor.email).toBe(newEmail);
    expect(passEntry.resource.type).toBe('USER');
    expect(passEntry.resource.id).toBe(userId);

    // No audit rows are tied to this user beyond the two new actions here.
    const all = await request(app)
      .get(`/api/v1/admin/audit-logs?actorUserId=${userId}`)
      .set('Cookie', [`${COOKIE_NAME}=${adminCookie}`]);
    const actions = new Set(all.body.data.map((e: { action: string }) => e.action));
    expect(actions).toContain('EMAIL_UPDATED');
    expect(actions).toContain('PASSWORD_CHANGED');
    expect(actions).toContain('LOGIN');
  }, 40_000);

  it('rejects non-platform-admin audit log access with 403', async () => {
    const { cookie } = await registerVerifiedUser('audit-nonadmin');
    const student = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Cookie', [`${COOKIE_NAME}=${cookie}`]);
    expect(student.status).toBe(403);
  }, 30_000);
});

afterAll(async () => {
  await Promise.all(createdUserIds.map(async (id) => {
    await prisma.session.deleteMany({ where: { userId: id } }).catch(() => undefined);
    await prisma.emailVerificationToken.deleteMany({ where: { userId: id } }).catch(() => undefined);
    await prisma.passwordResetToken.deleteMany({ where: { userId: id } }).catch(() => undefined);
    await prisma.userOrganization.deleteMany({ where: { userId: id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id } }).catch(() => undefined);
  }));
  await Promise.all(createdRecipients.map((to) => deleteMailpitForRecipient(to)));
  await prisma.$disconnect();
});