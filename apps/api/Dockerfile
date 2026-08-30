# syntax=docker/dockerfile:1

# LearnFlow API — Render Docker Web Service
# Build context MUST be the repository root (Render "Root Directory": ".")
# Dockerfile Path: apps/api/Dockerfile
# Everything below uses paths relative to the repository root.

# --- build stage ---------------------------------------------------------
FROM node:20 AS build

WORKDIR /app

# Root workspace manifest + the single root lockfile enable a reproducible install.
COPY package.json package-lock.json ./
# Workspace worktrees referenced by the root "workspaces" glob (apps/*, packages/*).
COPY apps ./apps
COPY packages ./packages

# @prisma/client's postinstall auto-generate runs at the install root where no
# schema exists; the API client is generated explicitly below.
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

# Reproducible install of the npm-workspaces monorepo from the root lockfile.
RUN npm ci

# @learnflow/validation publishes main: dist/index.js; build the workspace package
# (its own prepare script also runs during npm ci, this is an explicit no-op guard).
RUN npm --prefix packages/validation run build

# Generate the Prisma Client (schema lives at apps/api/prisma/schema.prisma),
# then type-check and compile the API to apps/api/dist.
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

# Remove dev-only dependencies (TypeScript, Prisma CLI, test tooling, ...) so the
# runtime image carries production dependencies only.
RUN npm prune --omit=dev

WORKDIR /app

# --- runtime stage -------------------------------------------------------
FROM node:20 AS runtime

ENV NODE_ENV=production

WORKDIR /app

# Pruned node_modules (includes generated Prisma client + engine in node_modules/.prisma/client).
COPY --from=build /app/node_modules ./node_modules
# Workspace packages (symlink targets under node_modules/@learnflow/*).
COPY --from=build /app/packages ./packages
# Compiled API output, its manifest and Prisma schema/migrations (for later migrate/seed).
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

# Render provides PORT at runtime; server.ts already listens on process.env.PORT and
# fallbacks to 4000 only when PORT is unset. No host is hard-coded; external services
# (Postgres, Redis, Cloudinary, SMTP) come from Render environment variables.
CMD ["node", "apps/api/dist/server.js"]