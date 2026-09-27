-- A team member needs a stable, readable address for its own page. Every
-- other translated entity already carries a per-language slug; this brings
-- team members in line rather than putting cuids in public URLs.
--
-- Nullable, because the column is added to a database that already has rows.
-- The seed backfills them and the admin derives a slug from the name on save.
ALTER TABLE "team_member_translation" ADD COLUMN "slug" TEXT;

-- Unique WITHIN a language, matching every other translation table:
-- /sr/tim/aleksandar-radivojevic and /en/tim/aleksandar-radivojevic are the
-- same person under two rows and must not collide with anyone else's.
-- Postgres treats NULLs as distinct, so rows not yet backfilled do not clash.
CREATE UNIQUE INDEX "team_member_translation_locale_slug_key"
  ON "team_member_translation"("locale", "slug");
