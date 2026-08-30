# PHASE 1 — AUTHENTICATION TEST REPORT

Scope: verify LearnFlow's real authentication implementation (register, email verification,
login/session, logout, password hashing, reset flow, protected routes, security controls, and
the frontend flows) end-to-end against the real Postgres / Redis / Mailpit / argon2 / Express /
Next.js stack. No application code was changed to make tests pass.

Status: **FUNCTIONAL CODE: PASS — PRE-EXISTING E2E SPEC: FAIL (test-spec defects)**

---

## 1. Environment & stack under test

- API: Express + Prisma/PostgreSQL + Redis (ioredis) + Mailpit (SMTP :1025, API :8025) + argon2.
- Web: Next.js (App Router, `next dev`) with direct browser → API CORS calls.
- Auth details verified: argon2 hashing with unique salts (BCRYPT not used), per-algorithm
  compare guard, httpOnly `SameSite=Lax` session cookie via signed sid, rolling session TTL
  (7d, refreshed on activity), email verification tokens (24h expiry, single-use, stored
  hashed), CSRF middleware, per-IP + per-email rate limits, brute-force lockout.
- CORS/CSRF allowlist includes the E2E origins `http://localhost:3000` and `http://localhost:3001`.

## 2. Verification evidence

### API-level (real services, real DB/Redis/Mailpit)

- New dedicated suite `apps/api/src/__tests__/auth.integration.test.ts` — **48/48 PASS**.
  Covers: register (success incl. unverified flag, duplicate email 409, weak password 400),
  login (success + session cookie issued, wrong password 401, unknown email 401, unverified
  user blocked 403, case-insensitive email lookup), logout (session destroyed), `GET /me`
  (authed vs unauthenticated), verify-email (marks `emailVerified`, clears unverified flag,
  invalid / expired / already-used tokens), resend-verification, forgot-password /
  reset-password (token expiry, one-time use), change-password (wrong-current-password,
  same-as-current rejected, success invalidates other sessions), CSRF (missing token 403),
  protected-route auth guards (401) and role guards (403), brute-force lockout.
- Full suite: **49 files / 737 tests PASS** (`npx.cmd vitest --run --pool=forks`, EXIT=0;
  log `%TEMP%\opencode\vitest-full.log`). `--pool=forks` required: the default worker pool
  crashes on Windows (access violation 0xC0000005).

### Type checks

- `npx.cmd tsc -p apps/api/tsconfig.json --noEmit` → PASS (EXIT=0)
- `npx.cmd tsc -p apps/web/tsconfig.json --noEmit` → PASS (EXIT=0)
  (needed removal of corrupt generated `.next/dev/types/routes.d.ts` + `validator.ts`
  artifacts left behind by an interrupted dev server; Next regenerates these.)

### Browser-level (Playwright + real Chromium, real servers: API :4100, web :3000)

Two controlled journeys executed against the live app (throwaway diagnostic spec, removed
after use; the repo spec was NOT modified):

- **Journey A — register → email verify → auto-login**: user registers through the real
  form (`POST /api/v1/auth/register` → 200, session cookie issued, "Account created
  successfully!" alert); verification token read from the real emailed link in Mailpit;
  `/verify-email?token=…` verifies the account; app auto-redirects (2s) to `/` → **PASS**.
- **Journey B — login → role-based dashboard**: seeded verified STUDENT signs in through
  the real form; post-login redirect resolves to `/dashboard/student`, heading
  "Welcome back, E2E Student" → **PASS**.

Both journeys confirm in the browser: registration, emailed verification link, verified
account, session creation, login, and role-based post-login redirect.

## 3. Findings

### No functional auth defects found in the application

Rate limiting, lockout, CSRF, argon2 hashing, session cookie attributes, rolling TTL,
verification-token expiry/single-use/hashed storage, email flow, and role-based redirects
all behave correctly under the integration suite and the live browser.

### Defect: `apps/web/e2e/specs/auth.spec.ts` cannot pass as written (test-spec bug)

1. **Register step flakiness (3 observed failures).** The app is correct, but under a cold
   dev harness the register response intermittently takes 15s+. Evidence: in one run the
   request's total time was 15.4s while the DB write completed at +5.8s and the browser
   eventually received `200` with the session cookie; in another the request was still
   pending (status −1) at test teardown. Identical flows complete in ~1–6s when the server
   is warm. The step's 15s `toBeVisible` budget is too tight for this harness
   (ts-node-dev + Turbopack + argon2 + Mailpit SMTP on Windows).
2. **Deterministic: the "then signs in" step is unreachable.** Registration already logs the
   user in (the register response sets the session cookie), and after verification
   `verify-email/page.tsx` schedules `window.location.href = '/'` after 2s. The spec's
   `page.goto('/login')` races that pending redirect → `net::ERR_ABORTED`, landing on `/`.
   A logged-in session can never reach the login form post-register.
3. **Stale final assertion.** `auth.spec.ts:23` expects a visible heading
   `Transform Learning into`, which exists only in the page `<title>` metadata
   (`layout.tsx:20,42,55`), never as a rendered heading. The real landing h1 is
   "Courses, progress, and goals — finally in one place." and the dashboard h1 is
   "Welcome back…". No green run is possible while this assertion stands.

Recommended fixes for the spec (out of scope for this phase to keep tests untouched):
(a) drop/raise the 15s toast budget on cold starts, (b) restructure to verify login in a
logged-out context or seed a second account rather than re-visiting `/login` mid-session,
(c) assert the actual landing/dashboard heading.

## 4. Coverage matrix

| Area                        | Covered by (integration) | Covered by (browser) | Result |
|-----------------------------|--------------------------|----------------------|--------|
| Register success            | ✓                        | ✓ (Journey A)         | PASS |
| Duplicate / invalid email   | ✓                        | –                     | PASS |
| Password policy             | ✓                        | –                     | PASS |
| Email verification link     | ✓                        | ✓ (Journey A)         | PASS |
| Token expiry / reuse        | ✓                        | –                     | PASS |
| Login + session cookie      | ✓                        | ✓ (Journey B)         | PASS |
| Login rate limit / lockout  | ✓                        | –                     | PASS |
| Logout                      | ✓                        | –                     | PASS |
| `GET /me` auth state        | ✓                        | –                     | PASS |
| Forgot / reset password     | ✓                        | –                     | PASS |
| Change password             | ✓                        | –                     | PASS |
| CSRF                        | ✓                        | –                     | PASS |
| Protected routes (401/403)  | ✓                        | –                     | PASS |
| Post-login role redirect    | ✓ (unit)                 | ✓ (Journey B)         | PASS |
| Frontend register/verify UI | –                        | ✓ (Journey A)         | PASS |

## 5. Commands to reproduce

```powershell
$env:env block per README (DATABASE_URL, REDIS_URL, MAIL_*, APP_URL, admin creds, etc.)
npx.cmd vitest --run --pool=forks                       # 49 files / 737 tests PASS
npx.cmd tsc -p apps/api/tsconfig.json --noEmit
npx.cmd tsc -p apps/web/tsconfig.json --noEmit
npx.cmd ts-node-dev --respawn --transpile-only src/server.ts   # API on :4100
npx.cmd next dev -p 3000                                       # web on :3000
# Playwright journeys were executed via a temporary diagnostic spec (removed).
```

## 6. Remaining gaps

- Final green pass of the unmodified `auth.spec.ts` is blocked by the test-spec defects in
  §3 (flaky toast budget, unreachable login step, stale heading assertion), not by the app.
- Lockout/rate-limit and phone-verification behaviors were exercised with short
  thresholds/emails in the integration suite; the browser lockout UI was not exercised.