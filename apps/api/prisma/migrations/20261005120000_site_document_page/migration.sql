-- A page of its own for each certificate.
--
-- Until now a document was a row in the footer: a badge, a file, and a short
-- line of hover text. It had no address, so it could not be linked to, shared,
-- or found in a search — which is what the SEO fields asked for here would have
-- been written for.
--
-- Nullable, like team_member_translation.slug and for the same reason: the
-- column arrives in a database that already has rows. A document without a
-- slug simply has no page yet and its footer badge keeps linking straight to
-- the file; the admin fills the slug in from the name the first time the
-- document is saved.
ALTER TABLE "site_document_translation" ADD COLUMN "slug" TEXT;

-- Longer copy for the page itself. `description` stays the one-line summary
-- shown on hover in the footer and used as the fallback meta description; a
-- page needs more than that to be worth ranking.
ALTER TABLE "site_document_translation" ADD COLUMN "body" TEXT;

-- The two fields the client asked for. Both optional: blank means the page
-- falls back to the document's own name and description.
ALTER TABLE "site_document_translation" ADD COLUMN "seoTitle" TEXT;
ALTER TABLE "site_document_translation" ADD COLUMN "seoDescription" TEXT;

-- Unique WITHIN a language, matching every other translation table.
-- Postgres treats NULLs as distinct, so the rows that have no slug yet do not
-- collide with each other.
CREATE UNIQUE INDEX "site_document_translation_locale_slug_key"
  ON "site_document_translation"("locale", "slug");
