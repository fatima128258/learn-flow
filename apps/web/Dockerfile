FROM node:20-alpine AS build

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy workspace packages
COPY packages ./packages

# Copy apps
COPY apps ./apps

# Install dependencies reproducibly
RUN npm ci

# Build Next.js
WORKDIR /app/apps/web
RUN npm run build

# --- runtime stage ---
FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

# Copy node_modules from build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["npm", "--prefix", "apps/web", "run", "start"]