# ── deps ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci

# ── build ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --schema apps/api/prisma/schema.prisma \
 && npm run build --workspace=@teamenergo/shared \
 && npm run build --workspace=@teamenergo/api

# ── runtime ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs api

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

RUN mkdir -p /app/uploads && chown -R api:nodejs /app/uploads

USER api
EXPOSE 4000

# Schema and content are both brought up to date on boot, so a deploy never
# needs a manual step and a fresh database is immediately usable.
#
# The seed is idempotent by design, so running it on every start is safe: it
# creates what is missing, reconciles the admin password while the account
# still carries the initial one, and leaves everything else alone. Without
# this a brand-new deployment would come up with forty empty tables and no
# admin user, which means no way to sign in and nothing to fix it with.
#
# Migrations gate startup — the API cannot serve against the wrong schema.
# A failed seed only warns, because an established site should not go down
# over content that is already there.
CMD ["sh", "-c", "\
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && \
{ npx tsx apps/api/prisma/seed.ts || echo 'WARNING: seed did not complete — see the output above'; } && \
node apps/api/dist/index.js"]
