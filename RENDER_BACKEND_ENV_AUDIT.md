# LearnFlow — `apps/api` Render Backend Deployment: Environment Variables Audit

> Scope: `apps/api` deployment to **Render as a Docker Web Service** for **production**.
> This document is an audit ONLY. **Nothing was deployed, committed, or modified** outside this report file.

---

## 1. Project Environment Loading Mechanism

### How `apps/api` loads environment variables

**`apps/api` reads environment variables directly from `process.env`.** There is **no `dotenv` import, no `dotenv` dependency, and no `config()` call anywhere** in `apps/api/src` or its bootstrap (`server.ts`). The full grep for `dotenv`/`config()` returned no matches.

Consequences, precisely:

- **Does `apps/api` read the root `.env`?** **No.** Nothing loads the root `.env` into the process. The root `.env` exists only for convenience of local scripts (and the values in it are mirrored in `docker-compose.yml`). If you run the API directly on the host (`node dist/server.js`) it reads whatever is in the shell/environment — not the root `.env`.
- **Does Docker provide the variables?** **Yes for local Docker Compose** — `docker-compose.yml` injects every variable via the `api` service's `environment:` block. It does **not** read the root `.env` from inside the container.
- **Does the API require `apps/api/.env`?** **No.** There is no `apps/api/.env` today, and no code loads one. The API is environment-agnostic: it only needs the variables present in `process.env`.
- **Should an `apps/api/.env` file be created?** **No.** The application does not load `.env` files at all (`dotenv` is not used). Creating `apps/api/.env` would have **zero effect**. ⚠️ Additionally, `apps/api/Package.json` declares dependency `@learnflow/validation` as `file:../../packages/validation` whose own `package.json` runs `prepare`/`build` — irrelevant to env loading.

**For Render:** Render injects your configured **Environment Variables** directly into the process environment of the Web Service. Because the app reads `process.env` directly, Render's env-variable panel is the correct and **only** place to define production values. You **do not** need any `.env` file. `NODE_ENV` is set to `production` by Render automatically.

---

## 2. Complete Environment Variable Inventory

Every `process.env` the API reads (from source and Prisma seed), with its actual default and usage.

| Variable | Required? | Used By | Local/Docker Value | Render Production Value Needed? | Secret? | Notes |
| -------- | --------- | ------- | ------------------ | ------------------------------- | ------- | ----- |
| `PORT` | **Yes (start)** | `src/server.ts:154` | `4000` (default) | Yes — Render sets its own `PORT` | No | Server listen port. Default `4000` if unset. |
| `DATABASE_URL` | **Yes** | Prisma client (via `@prisma/client`), `prisma/seed.js` | `postgresql://learnflow:learnflow_pass@localhost:5432/learnflow_db?schema=public` (local) / `@db:5432` (Compose) | **Yes** | **Yes** | PostgreSQL connection URL. Used implicitly by `PrismaClient`. |
| `REDIS_URL` | **Yes (core dependency)** | `src/utils/redis.ts:7`, `src/queues/notificationWorker.ts:9` | `redis://localhost:6379` (local) / `redis://redis:6379` (Compose) | **Yes** | **Yes** | Used for rate limiting, brute-force protection, sessions TTL support, the BullMQ notification queue + worker. No Redis ⇒ rate limiting/queue degrade. |
| `SESSION_COOKIE_NAME` | No (has default) | `src/middleware/auth.ts:5`, `src/controllers/authController.ts:17` | `learnflow_session` | Yes (recommended, not secret) | No | HttpOnly session cookie name. |
| `SESSION_COOKIE_SECURE` | No (has default) | `src/middleware/security.ts:5`, `src/controllers/authController.ts:18` | `false` | **Yes — set `true`** | No | If `NODE_ENV=production` (Render default) cookie becomes `secure` automatically; explicitly set `true` to be safe. |
| `SESSION_TTL_SECONDS` | No (hard default in code) | — | `604800` | Optional | No | Code hard-defaults to 7 days; the env var is **not read** by `apps/api` (only in `docker-compose.yml`). Rendering it is harmless but not used by this codebase. |
| `CORS_ALLOWED_ORIGINS` | **Yes for browser access** | `src/config/origins.ts:11` | `http://localhost:3000` etc. (built-in defaults) | **Yes** | No | Comma-separated list of allowed browser origins. Must include your production `apps/web` URL, or CORS/CSRF will reject frontend calls. |
| `APP_URL` | **Yes for email** | `src/utils/email.ts:142,168` | `http://localhost:3000` | **Yes** | No | Base URL embedded in email verification & password-reset links (points to the frontend). |
| `API_BASE_URL` | **Yes for certificates** | `src/services/certificateService.ts:13` | `http://localhost:4000` | **Yes** | No | Base URL of the **API itself**, used to build certificate verify/download URLs. Distinct from `APP_URL`. 🔴 Required, otherwise certificate links point at `localhost:4000`. |
| `MAIL_SMTP_HOST` | **Yes for email** | `src/utils/email.ts:111` | `localhost` (local/Mailpit) / `mailpit` (Compose) | **Yes** | No | SMTP host. |
| `MAIL_SMTP_PORT` | **Yes for email** | `src/utils/email.ts:112` | `1025` (Mailpit) | **Yes** | No | SMTP port. |
| `MAIL_FROM` | No (has default) | `src/utils/email.ts:126` | `no-reply@learnflow.local` | **Yes** | No | From-address on sent mail. |
| `MAIL_SMTP_USER` / `MAIL_SMTP_PASS` | Optional | Not read by code ❗ | — | **No** (see note) | **Yes** | ⚠️ The current SMTP transporter (`src/utils/email.ts:109-123`) uses **`auth: undefined` and `ignoreTLS: true`** (Mailpit-only). A production SMTP provider that requires auth/TLS cannot be configured via env vars today — **code change required** before email works against a real provider (do NOT change auth/business logic without a separate decision; flag only). |
| `STORAGE_DRIVER` | Yes (default `s3`) | `src/storage/index.ts:12` | `s3` | Yes | No | `s3` / `minio` / `r2` all map to the MinIO S3 client. |
| `STORAGE_ENDPOINT` | **Yes** | `src/storage/minioProvider.ts:27` | `localhost` (local) / `minio` (Compose) | **Yes** | No | Object-storage endpoint host. |
| `STORAGE_PORT` | Yes (default 9000) | `src/storage/minioProvider.ts:28` | `9000` | Yes | No | Object-storage port. |
| `STORAGE_USE_SSL` | Yes | `src/storage/minioProvider.ts:29` | `false` | **Yes — set `true` for TLS providers (S3/R2)** | No | |
| `STORAGE_ACCESS_KEY` | **Yes** | `src/storage/minioProvider.ts:30` | `minioadmin` (local) | **Yes** | **Yes** | |
| `STORAGE_SECRET_KEY` | **Yes** | `src/storage/minioProvider.ts:31` | `minioadmin` (local) | **Yes** | **Yes** | |
| `STORAGE_BUCKET` | Yes (default `learnflow`) | `src/storage/minioProvider.ts:33` | `learnflow` | **Yes** | No | |
| `STORAGE_REGION` | No (default `us-east-1`) | `src/storage/minioProvider.ts:85` | `us-east-1` | Yes (recommended) | No | Used for `makeBucket`. |
| `STORAGE_PUBLIC_URL` | Optional (nullable) | `src/storage/minioProvider.ts:34` | `http://localhost:9000` (local) | **Optional** — leave empty for private-bucket/presigned-URL mode | No | If empty, public URLs fall back to presigned URLs. |
| `MEILISEARCH_HOST` | Optional | `src/services/healthService.ts:86` (health probe only) | `http://localhost:7700` | Optional | No | 🔶 Search is **not** done via Meilisearch — see §5. Only used for the `/api/health` dependency probe. |
| `MEILISEARCH_API_KEY` | Optional | `src/services/healthService.ts:87` | `masterKey` | Optional | **Yes** | Same as above — health probe only. |
| `API_RATE_LIMIT_WINDOW_MS` | No (default 60000) | `src/middleware/rateLimit.ts:103` | `60000` | Optional | No | |
| `API_RATE_LIMIT_MAX` | No (default 300) | `src/middleware/rateLimit.ts:104` | `300` | Optional | No | |
| `NOTIFICATIONS_QUEUE_ENABLED` | No (default enabled) | `src/queues/notificationQueue.ts:9` | (unset ⇒ enabled) | Optional | No | Set `false` to disable the BullMQ queue and send notifications inline. |
| `NODE_ENV` | **Yes** | `security.ts:4`, `authController.ts:18`, queues | Render sets `production` | Set by Render | No | Controls secure-cookie + HSTS behavior. |
| `ADMIN_EMAIL` | Seed only | `prisma/seed.js:9` | — | **Yes for first-time DB setup** | No | Only needed if you run `prisma/seed.js`. |
| `ADMIN_PASSWORD` | Seed only | `prisma/seed.js:10` | — | **Yes for first-time DB setup** | **Yes** | Only needed if you run `prisma/seed.js`. |

> Totals: **Required on Render ≈ 20 real variables** (grouped in §3). Everything else is optional or seed-only.

---

## 3. Required Render Variables (grouped)

### 3A. Required for API startup
- `PORT` — Render sets this automatically (Render injects its own `PORT`). No manual value needed, but it's safe to omit.

> Note: There is **no startup-time validation** of required env vars in this codebase — most have fallback defaults (often pointing at `localhost`). The API will *start* even with missing config, but then be **non-functional or insecure** (broken DB, Redis on localhost, Mailpit SMTP, MinIO on localhost, cert URLs at localhost). So "can start" ≠ "works in production."

### 3B. Required for database
- `DATABASE_URL` — production PostgreSQL connection string.

### 3C. Required for authentication / security
- `SESSION_COOKIE_NAME` — set to a stable cookie name.
- `SESSION_COOKIE_SECURE` — `true` in production (Render sets `NODE_ENV=production` which already forces secure; set explicitly for clarity).
- `CORS_ALLOWED_ORIGINS` — your production frontend origin(s).
- `NODE_ENV` — set by Render to `production`.

### 3D. Required for Redis
- `REDIS_URL` — production Redis connection string.

### 3E. Required for object storage
- `STORAGE_DRIVER` (`s3`)
- `STORAGE_ENDPOINT`, `STORAGE_PORT`, `STORAGE_USE_SSL`
- `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`, `STORAGE_REGION`

### 3F. Required for search
- **None required.** Meilisearch is **not used** for search (see §5). Only `MEILISEARCH_HOST`/`MEILISEARCH_API_KEY` feed the optional health probe.

### 3G. Required for email
- `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT`, `MAIL_FROM`, `APP_URL`
- 🔴 **Provider auth/TLS caveat** — see §6/§9.

### 3H. Required for CORS / frontend / links
- `CORS_ALLOWED_ORIGINS`, `APP_URL` (frontend base for email links), `API_BASE_URL` (backend base for certificate URLs).

### 3I. Optional
- `SESSION_TTL_SECONDS` (not read by code here — harmless), `API_RATE_LIMIT_WINDOW_MS`, `API_RATE_LIMIT_MAX`, `NOTIFICATIONS_QUEUE_ENABLED`, `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY`, `STORAGE_PUBLIC_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (seed-time only).

---

## 4. Production Networking Check — Docker Compose hostnames

Local `docker-compose.yml` points the API at internal service hostnames. Those will **NOT resolve** on Render because the API is deployed as an independent service on Render, not as part of that Compose network. **You must replace these with real provider endpoints.**

| Local/Docker value | Docker Compose service | Render replacement required |
| ------------------ | ---------------------- | --------------------------- |
| `DATABASE_URL=postgresql://...@db:5432/...` | `db` | **Production PostgreSQL** (nearest Render region) connection string. E.g. Render managed Postgres, or Postgres via Render/Neon/Supabase/etc. **Host = provider host, not `db`.** |
| `REDIS_URL=redis://redis:6379` | `redis` | **Production Redis** provider (e.g. Render Redis, Upstash, Redis Cloud). **Host = provider host, not `redis`.** |
| `STORAGE_ENDPOINT=minio`, `STORAGE_PUBLIC_URL=http://minio:9000` | `minio` | **Production S3-compatible object storage** (AWS S3, Cloudflare R2, Wasabi, etc.). Set `STORAGE_ENDPOINT` accordingly and `STORAGE_USE_SSL=true` for real S3/R2. |
| `MAIL_SMTP_HOST=mailpit`, `MAIL_SMTP_PORT=1025` | `mailpit` | **Production email/SMTP provider** (SendGrid, Postmark, Resend SMTP, etc.). See §6 auth caveat. |
| `MEILISEARCH_HOST=http://meilisearch:7700` | `meilisearch` | Optional — Meilisearch is not used for search (§5). If you want the health probe green, point at a Meilisearch host. |

**Rule:** Every one of `db`, `redis`, `minio`, `mailpit` (and `meilisearch` if you keep it) is a Compose-internal hostname that will **fail on Render** and must be replaced by a real production endpoint. **PostgreSQL is not replaced by another database** — it stays PostgreSQL, just hosted by a production provider instead of the `db` Compose container.

---

## 5. Render Architecture — Dependency Readiness

Intended architecture and status in the project:

| Dependency | Already configured in project? | Needs production provider on Render? |
| ---------- | ------------------------------ | ------------------------------------ |
| **PostgreSQL** | Yes — full Prisma schema + migrations + seed. Connection via `DATABASE_URL`. | **Yes — must provision** a production Postgres (Render managed Postgres recommended) and set real `DATABASE_URL`. |
| **Redis** | Yes — `ioredis` + BullMQ queue/worker; connection via `REDIS_URL`. | **Yes — must provision** a production Redis and set real `REDIS_URL`. |
| **Object storage (S3)** | Yes — MinIO S3 provider abstraction; config via `STORAGE_*`. | **Yes — must provision** an S3-compatible object store (S3/R2) and set real `STORAGE_*`. |
| **Meilisearch** | **Not actually integrated** — search uses PostgreSQL via Prisma (`src/repositories/searchRepository.ts`). Meilisearch only appears in the health probe. | **No** — not required for search. Optional only to make `/api/health` report search "up". |
| **Email/SMTP** | Yes — nodemailer configured, but **hardcoded for Mailpit (no auth, `ignoreTLS:true`)** (`src/utils/email.ts:109-123`). | **Yes — must provision** a real SMTP provider, but the transporter **cannot accept auth/TLS via env vars today** (see §6/§9 — code change needed before email works). |

**Important:** Render does **not** automatically provision Postgres, Redis, object storage, or email for a Docker Web Service. Each of PostgreSQL, Redis, and object storage **you must create/provision yourself** (Render offers managed Postgres and managed Redis you can attach; object storage and email require third-party providers).

---

## 6. Secrets

Identified secrets (shown **redacted only** — never their real values):

```
DATABASE_URL=<REDACTED>
REDIS_URL=<REDACTED>
STORAGE_ACCESS_KEY=<REDACTED>
STORAGE_SECRET_KEY=<REDACTED>
MAIL_SMTP_USER=<REDACTED>   (only if a provider supporting auth is added)
MAIL_SMTP_PASS=<REDACTED>   (only if a provider supporting auth is added)
MEILISEARCH_API_KEY=<REDACTED>
ADMIN_PASSWORD=<REDACTED>
```

Treat `DATABASE_URL`, `REDIS_URL`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `ADMIN_PASSWORD`, and any SMTP credentials as secrets. Store them in **Render's Encrypted Environment Variables** (the lock icon / "secret" toggle), never in the repo.

---

## 7. Render Environment Variable Checklist

Enter these into **Render → API Web Service → Environment & Files → Environment Variables**. Do not invent values — obtain each from its source.

```text
# Database
DATABASE_URL=

# Redis
REDIS_URL=

# Authentication / Security
SESSION_COOKIE_NAME=learnflow_session
SESSION_COOKIE_SECURE=true
CORS_ALLOWED_ORIGINS=
NODE_ENV=production      (set by Render, but confirm)

# Email
MAIL_SMTP_HOST=
MAIL_SMTP_PORT=
MAIL_FROM=
APP_URL=

# Certificate links (backend base URL)
API_BASE_URL=

# Object storage
STORAGE_DRIVER=s3
STORAGE_ENDPOINT=
STORAGE_PORT=
STORAGE_USE_SSL=true
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
STORAGE_BUCKET=
STORAGE_REGION=

# Optional
STORAGE_PUBLIC_URL=
MEILISEARCH_HOST=
MEILISEARCH_API_KEY=
```

Per-variable sourcing:

```text
DATABASE_URL
  Source: your production PostgreSQL provider (e.g. Render managed Postgres "External Database URL")
  Format: postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public
  Secret: Yes

REDIS_URL
  Source: your production Redis provider (e.g. Render Redis "Rediss URL"/"Internal URL", Upstash, Redis Cloud)
  Format: redis://[:password@]HOST:PORT  (use rediss:// for TLS where supported)
  Secret: Yes

SESSION_COOKIE_NAME
  Source: choose a value (must match any clients reading the cookie)
  Format: string
  Secret: No

SESSION_COOKIE_SECURE
  Source: set literally true
  Format: true
  Secret: No

CORS_ALLOWED_ORIGINS
  Source: your production apps/web URL (e.g. https://your-web-app.onrender.com)
  Format: comma-separated origins
  Secret: No

NODE_ENV
  Source: Render sets it; override only if needed
  Format: production
  Secret: No

MAIL_SMTP_HOST / MAIL_SMTP_PORT / MAIL_FROM
  Source: your email/SMTP provider's SMTP server + port + verified from-address
  Format: host string / integer port / email
  Secret: No (MAIL_* pass/user if added later: Yes)

APP_URL
  Source: your production frontend URL (used in email links)
  Format: https://your-web-app.onrender.com
  Secret: No

API_BASE_URL
  Source: the public URL of THIS API service on Render
  Format: https://your-api-service.onrender.com
  Secret: No

STORAGE_DRIVER
  Source: s3 (or minio/r2); must be one of the supported values
  Format: s3 | minio | r2
  Secret: No

STORAGE_ENDPOINT / STORAGE_PORT / STORAGE_USE_SSL
  Source: your S3-compatible provider's endpoint + port + TLS setting
  Example endpoints: s3.amazonaws.com, <account>.r2.cloudflarestorage.com, wasabi region endpoint
  Format: host / integer / true|false
  Secret: No

STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY
  Source: your object-storage provider's access key credentials
  Format: key strings
  Secret: Yes

STORAGE_BUCKET / STORAGE_REGION
  Source: bucket you created + that bucket's region
  Format: string / region id
  Secret: No

STORAGE_PUBLIC_URL (optional)
  Source: leave empty for private bucket/presigned URLs; else your bucket public base URL
  Secret: No

MEILISEARCH_HOST / MEILISEARCH_API_KEY (optional)
  Source: only if you run Meilisearch (not required for search)
  Secret: key is Yes, host is No
```

---

## 8. Render Docker / Monorepo Compatibility Assessment

Proposed Render config: `Language: Docker`, `Root Directory: apps/api`, `Branch: main`.

### ⚠️ This build is **BROKEN as-is** and must be fixed before deployment.

The repository is an **npm-workspaces monorepo**:
```
apps/api
apps/web
packages/{config,types,ui,validation}
package.json          (at repo root, workspaces: ["apps/*","packages/*"])
package-lock.json     (at repo root)
```

`apps/api/Dockerfile` copies only its own context:
```
FROM node:20
WORKDIR /app
COPY package.json package-lock.json ./   <-- copies apps/api/package.json + apps/api/package-lock.json
COPY tsconfig.json ./
RUN npm install --legacy-peer-deps || npm install
COPY . .
RUN npx prisma generate
RUN npm run build
CMD ["node", "dist/server.js"]
```

With **`Root Directory: apps/api`**, the Docker **build context is `apps/api` only** — the repo root, `apps/web`, and `packages/*` are **not visible** to the build. Problems:

1. **`@learnflow/validation` cannot be installed.** `apps/api/package.json` declares `"@learnflow/validation": "file:../../packages/validation"`. With context = `apps/api`, `../../packages/validation` is **outside the build context** and does not exist during `npm install` → install fails (or resolves nothing).
   - **However:** `@learnflow/validation` is **never imported anywhere** in `apps/api/src` (verified by grep), so it is effectively a **dead dependency**. The clean fix is to remove it from `apps/api/package.json` (and root lock) rather than try to ship the package into the build.
2. **Stale `apps/api/package-lock.json`.** This file (located inside `apps/api`, which the Dockerfile copies) is **out of sync** with `apps/api/package.json`: it lacks `bullmq`, `minio`, `multer`, `pdfkit`, `ioredis`, `@learnflow/validation`, and pins `@prisma/client` at `4.16.1` vs `^4.16.2`. `npm install` will partially re-resolve, but a dirty lockfile + context problem is fragile and non-reproducible.
3. **No root-level orchestration.** The Dockerfile does not run `npm ci`/build at the monorepo root, so it never sees workspaces as designed. It relies purely on the single `apps/api` package.
4. **`npm install` (not `npm ci`)** — non-reproducible builds on Render.

### Recommended fix (do NOT modify Docker unless necessary, but this WILL fail as-is)
- **Option A (simplest, recommended):** Run a **pre-deploy `npm install`/build and deploy the compiled `dist/`** via a Render **Docker** image whose context is the **repo root** (`Root Directory: .` or the repo root, and a root-level `Dockerfile` that builds `apps/api`), OR use Render to run `npm install && npm run build --workspace apps/api` from the root context.
- **Option B:** Change `Root Directory` to the **repository root** and add a monorepo-aware `Dockerfile` (or adjust build to run from root where `packages/*` are present), removing the dead `@learnflow/validation` `file:` dep and using `npm ci`.
- Specifically: **`Root Directory: apps/api` with the current Dockerfile will not work** because the `file:../../packages/validation` dependency points outside the build context. You must either widen the context to the repo root or drop that dead dependency and give Render a valid lockfile.

> Do not deploy with `Root Directory: apps/api` and this Dockerfile as-is — it will fail to build.

---

## 9. Production Safety Findings

- **No hard-coded production secrets in source:** The source tree contains only `minioadmin`/`masterKey`-style **development defaults** inside fallback expressions (`utils/redis.ts`, `minioProvider.ts`, `docker-compose.yml`), none of which are production values. No real passwords/keys hard-coded in code.
- **`.env` is not committed:** `git ls-files` returns only `.env.example`. Root `.env` and `apps/web/.env.local` are git-ignored and untracked. ✅
- **`.env.example` contains placeholders only:** ✓ (`ADMIN_EMAIL=`/`ADMIN_PASSWORD=` are empty; everything else is local/dev sample values, with an explicit comment not to put real secrets there). ✅
- **Production database is NOT configured as localhost:** Correct in the sense that there's no production config at all — but be aware the **default fallback** is `localhost` (`@localhost:5432` / `redis://localhost:6379` / `STORAGE_ENDPOINT=localhost`). **On Render you MUST override all of these** or the API will try to connect to `localhost` inside its own container and fail.
- **No dev-only Mailpit used accidentally:** The current SMTP transporter is **hardcoded for Mailpit** (`auth: undefined`, `ignoreTLS: true`, default host/port 1025). If you set `MAIL_SMTP_HOST` to a real provider without a code change, **mail will NOT authenticate** — a functional gap, not a leak.
- **No dev-only MinIO used accidentally:** The storage driver is S3-compatible by architecture; you must point `STORAGE_ENDPOINT` at your production provider and set `STORAGE_USE_SSL=true`. Default fallback is `localhost:9000` (MinIO) — must be overridden.
- **`apps/api/.dockerignore` excludes `.env` / `.env.*`** from the image — good (secrets won't bake into the image). ✅
- **Recommended pre-deploy:** it is NOT safe to rely on defaults. Provide all Required variables explicitly on Render.

---

## 10. Exact Next Steps Before Deployment

1. **Fix the Docker build** (blocker): Widen the build root-level OR remove the dead `@learnflow/validation` dep and provide a synced lockfile — see §8. Do **not** deploy with `Root Directory: apps/api` + current Dockerfile.
2. **Provision production PostgreSQL** (Render managed Postgres recommended). Run `npx prisma migrate deploy` against it  → set `DATABASE_URL`.
3. **Provision production Redis** (Render managed Redis or third party) → set `REDIS_URL`.
4. **Provision object storage** (AWS S3 / Cloudflare R2 / Wasabi) → create bucket + access keys → set all `STORAGE_*`; decide `STORAGE_PUBLIC_URL` (empty for private/presigned mode).
5. **Decide email provider & flag the auth/TLS code gap**: the current transporter cannot auth to a real SMTP provider via env vars. Decide whether pro-notify email is required; if so, a small code change is required (out of scope here — business logic unchanged). Set `MAIL_SMTP_HOST/PORT/FROM`, `APP_URL`.
6. **Set `API_BASE_URL`** = public URL of the Render API service (certificate links), and `APP_URL` = public frontend URL (email links).
7. **Set `CORS_ALLOWED_ORIGINS`** to the production frontend origin and `SESSION_COOKIE_SECURE=true`.
8. **Enter all Required env vars** (with secrets marked encrypted) using the §7 checklist. Confirm `NODE_ENV=production`.
9. **Seed the platform admin once** (if first DB setup) using `ADMIN_EMAIL` / `ADMIN_PASSWORD`, then remove them.
10. **Verify** on Render: hit `/api/health` and `/api/ready`; confirm `database`, `redis`, `objectStorage` are `up`; verify login, a course image upload (object storage), an enrollment notification email, and a certificate link (API_BASE_URL + storage presigned URL).
11. **Do not** create `apps/api/.env` (unused). **Do not** deploy with `localhost` defaults.

---

### One-line answers (the questions you asked)
- Does `apps/api` read the root `.env`? **No** (no dotenv anywhere).
- Does Docker provide the variables? **Only locally via `docker-compose.yml`**; on Render you set them in the env panel.
- Does the API require `apps/api/.env`? **No.**
- Should `apps/api/.env` be created? **No** — it would have no effect.
