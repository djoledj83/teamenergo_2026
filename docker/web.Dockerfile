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

# NEXT_PUBLIC_* is inlined into the client bundle at BUILD time, so it has to
# arrive here as a build arg. Setting it only in docker-compose's
# `environment:` puts it in the running container, where the browser bundle
# has already been written and will never read it — the same shape of mistake
# as the uploads rewrite that baked in localhost:4000.
#
# Empty is fine and means the feature is simply off: no key, no map.
ARG NEXT_PUBLIC_GOOGLE_MAPS_KEY=""
ENV NEXT_PUBLIC_GOOGLE_MAPS_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_KEY

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace=@teamenergo/shared \
 && npm run build --workspace=@teamenergo/web

# ── runtime ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# `output: standalone` preserves the workspace layout, so server.js sits
# under apps/web and static assets are copied in beside it.
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
