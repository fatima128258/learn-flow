# LearnFlow — Learning Management System

A full-stack, multi-tenant learning management system with role-based access control, course publishing, a banner/thumbnail media pipeline, search, notifications, certificates, analytics, and a completed commerce flow (orders, checkout, enrollments).

## Architecture

<div align="center">
  <table>
    <tr><th>App / Package</th><th>Technology</th><th>Path</th></tr>
    <tr><td><code>web</code></td><td>Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, TanStack Query</td><td><code>apps/web</code></td></tr>
    <tr><td><code>api</code></td><td>Express, TypeScript, Prisma ORM, BullMQ (queues), Multer/MinIO (files), Nodemailer</td><td><code>apps/api</code></td></tr>
    <tr><td><code>config</code></td><td>Shared environment configuration</td><td><code>packages/config</code></td></tr>
    <tr><td><code>types</code></td><td>Shared TypeScript types</td><td><code>packages/types</code></td></tr>
    <tr><td><code>ui</code></td><td>Shared UI components</td><td><code>packages/ui</code></td></tr>
    <tr><td><code>validation</code></td><td>Shared request validation schemas</td><td><code>packages/validation</code></td></tr>
  </table>
</div>

**External services:** PostgreSQL (data), Redis (sessions, rate limiting, BullMQ), MinIO (S3-compatible media — course banners, thumbnails, lesson resources), Meilisearch (course search), Mailpit (SMTP + web UI for email tests). Docker Compose in the repo root launches all of them.

## Getting started

Prerequisites: Node.js 20+, Docker (for the external services), npm.

```bash
# 1. Install dependencies (npm workspaces hoist to the root node_modules)
npm install

# 2. Start external dependencies
docker compose up -d

# 3. Apply database migrations and seed the platform admin
cd apps/api
npx prisma migrate deploy
npm run seed
cd ../..

# 4. Run the API (http://localhost:4000) in one terminal
cd apps/api && npm run dev

# 5. Run the web app (http://localhost:3000) in another
cd apps/web && npm run dev
```

The seed creates the platform administrator account (see `apps/api/prisma/seed.js`). Platform admin logs in at `/login`, then creates an organization, assigns an organization admin, and grants permissions before organization admins can onboard instructors and students.

### Environment variables

Copy the root `.env.example` into `apps/api/.env`. It documents every variable the API reads: `DATABASE_URL` (Postgres), `REDIS_URL`, Mailpit SMTP settings (`MAIL_SMTP_HOST`/`MAIL_SMTP_PORT`/`MAIL_FROM`), `APP_URL`, session configuration (`SESSION_COOKIE_NAME`/`SESSION_TTL_SECONDS`), seeded admin credentials (`ADMIN_EMAIL`/`ADMIN_PASSWORD`), and object storage (`STORAGE_DRIVER`/`STORAGE_ENDPOINT`/`STORAGE_*`). Meilisearch is configured via `MEILISEARCH_HOST`/`MEILISEARCH_ADMIN_KEY`.

The web app reads `apps/web/.env.local` — it only needs `NEXT_PUBLIC_API_URL` (set to `http://localhost:4000` during local development).

## Commands

| Script | Location | Purpose |
| ------ | -------- | ------- |
| `npm run dev` / `npm run build` / `npm run start` | root | Run/build/start the web app |
| `npm run lint` | root | ESLint for the web app |
| `npm test` | root | Run all Vitest suites (root + api) |
| `cd apps/api && npm run test` | api | API integration & unit tests |
| `cd apps/api && npm run migrate:deploy` | api | Apply Prisma migrations |
| `cd apps/api && npm run seed` | api | Seed platform admin |

> Note: the root `eslint` binary currently fails to load `eslint-config-next`'s bundled Babel parser under ESLint 9 (`Cannot find module 'next/dist/compiled/babel/eslint-parser'`). This is a pre-existing tooling issue; `next build` still runs its own type-checking and compiles cleanly.

## Feature overview

- **Auth & security** — Argon2 password hashing, secure httpOnly sessions, email verification, forgot/reset password, per-IP login rate limiting and brute-force lockout, CSRF-safe context, audit logging (auth + entity events).
- **Roles** — `PLATFORM_ADMIN`, `ORG_ADMIN`, `INSTRUCTOR`, `STUDENT`, protected route/guard middleware throughout.
- **Organizations** — multi-tenant orgs, onboarding flow, users management (add instructor/student), analytics, settings.
- **Courses** — by-role course builders: modules → lessons → quizzes → questions; draft/published lifecycle; student enrollment gating; learning progress tracking.
- **Commerce** — course detail pages with pricing, checkout/order creation, purchase → enrollment webhook-style flow (Section 17 implemented end-to-end in the UI).
- **Media** — Multer upload, MinIO storage, thumbnail processing queue, lesson resources.
- **Search & notifications** — Meilisearch-backed course search; in-app + email notifications via BullMQ dispatch.
- **Certificates** — auto-issue on completion, PDF generation.
- **Reporting** — platform metrics, organization analytics, audit logs, student progress.

## State management (Section 18)

- **Server state** → **TanStack Query** (`@tanstack/react-query`): `/auth/me`, course overviews, purchases, dashboard data hooks with 30s stale time and cache invalidation after mutations (`QueryClient` provided in `src/providers/QueryProvider.tsx`). This removes hand-rolled `fetch`-in-`useEffect` for the new pages.
- **Local/UI state** → React `useState` (form fields, modal open/close, filter inputs). No global store (Redux/Zustand) is used — server state lives in the query cache, UI-only state stays in components.
- **UX rigor** — route-level loading skeletons, error boundaries/error states, toasts for mutation feedback, keyboard-accessible dialogs (focus trap, Escape to close), aria-labelledby/`aria-invalid`/`aria-describedby` on inputs, skip-to-content link.
- Hooks live under `apps/web/src/features/*` (auth, student, organizationAdmin, platformAdmin) and shared UI under `apps/web/src/components`.

## API surface

Routes live in `apps/api/src/routes`. Key groups: auth, users, organizations + org-admin, courses/modules/lessons/quizzes, enrollments, progress, commerce (orders, checkout), certificates, notifications, search, media, platform-admin, audit-logs. Responses use a consistent envelope (e.g. `{ success, data }` or `{ success, data, meta }` for paginated lists) under the `/api/v1` base path.

## Testing

- **API** — 661 Vitest + Supertest tests across 46 suites in `apps/api/src/__tests__` (routes, services, events, security, standards) plus a full-journey integration test (`studentPurchaseJourney.routes.test.ts`). Run with `cd apps/api && npm test`.
- **Web** — 10 Vitest tests (`apps/web`).
- **Coverage** — `npx vitest run --coverage` (Vitest `@vitest/coverage-v8`) at the workspace root. Current: statements 88%, branches 76%, functions 90%, lines 88%.
- **E2E** — Playwright: 5 spec files / 7 tests in `apps/web/e2e` (registration + emailed verification via Mailpit, course catalog, purchase journey, org-admin user management, platform-admin org creation, instructor dashboard). Run with `npx playwright test` from `apps/web`. A `globalSetup` reseeds deterministic fixtures each run via `apps/api/scripts/seed-e2e.mjs` (org, platform/org admins, instructor, students; one PUBLISHED and one DRAFT course; credentials read from `apps/web/e2e/.local/seed.json`). The E2E stack runs against host processes: start the API with the root `.env` vars and `PORT=4100`, the web app with `NEXT_PUBLIC_API_URL=http://localhost:4100` on any CORS-allowlisted port (default `3001`, override with `E2E_WEB_PORT`), and Mailpit on 8025. Requires Postgres/Redis/MinIO up and a Playwright browser installed.

## Deployment & known limitations

- Each app has a `Dockerfile`; the workspaces root `docker-compose.yml` orchestrates services for local development.
- **Known issues to address before production:**
  1. The compose `api` service currently injects `DATABASE_URL=${DATABASE_URL}` (host `localhost:5432`) into the container, so the containerized API cannot reach Postgres — use host-run processes for the E2E stack, or switch that env to the `db` service name.
  2. Meilisearch is used by the API but not yet declared in `docker-compose.yml`; start it manually.
  3. `GET /api/health` and `/api/ready` are not implemented (return 404) — readiness probes in any orchestrator need those endpoints or a different check.
- **Notable fixes during E2E bring-up:** the BullMQ notification worker now opens its own connection with `maxRetriesPerRequest: null` (`apps/api/src/queues/notificationWorker.ts`) so the API boots when Redis is present. In some environments ports 3000/4000 are already served by another (e.g. WSL/container) process; give the E2E stack its own host ports.
- Kubernetes manifests are not included; the app is designed to run as stateless containers with external Postgres/Redis/MinIO/Meilisearch.