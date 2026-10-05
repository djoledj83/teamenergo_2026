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

# ── GeoIP ─────────────────────────────────────────────────────────────
# DB-IP's IP-to-Country Lite, CC-BY 4.0: no account, no key, no secret in
# .env. Used to turn a visitor's address into a country code in memory; the
# address itself is never stored. The credit the licence asks for is on the
# Analitika screen.
#
# `|| true` throughout, deliberately. This is a nice-to-have on a brochure
# site, and a month boundary, a DB-IP outage or a build machine without
# egress must not be able to fail a deployment. Without the file the API logs
# one warning and visits simply have no country.
#
# Two months are tried because the current month's file does not exist until
# DB-IP publishes it.
FROM alpine:3.21 AS geoip
RUN apk add --no-cache curl
WORKDIR /geoip
RUN THIS=$(date -u +%Y-%m) \
 && LAST=$(date -u -d "$(date -u +%Y-%m-01) -1 day" +%Y-%m 2>/dev/null || echo "$THIS") \
 && (curl -fsSL -o db.mmdb.gz "https://download.db-ip.com/free/dbip-country-lite-$THIS.mmdb.gz" \
  || curl -fsSL -o db.mmdb.gz "https://download.db-ip.com/free/dbip-country-lite-$LAST.mmdb.gz" \
  || true) \
 && (gunzip -c db.mmdb.gz > dbip-country-lite.mmdb || true) \
 && rm -f db.mmdb.gz \
 && (test -s dbip-country-lite.mmdb && echo "GeoIP database fetched" \
  || (echo "WARNING: no GeoIP database; visits will have no country" && : > dbip-country-lite.mmdb))

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
COPY --from=geoip /geoip/dbip-country-lite.mmdb ./data/dbip-country-lite.mmdb

# An empty file means the download failed; geo.ts treats a database it cannot
# read exactly like one that is not there.
ENV GEOIP_DB=/app/data/dbip-country-lite.mmdb

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
