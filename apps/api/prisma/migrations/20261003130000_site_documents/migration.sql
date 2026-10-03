-- Certifications, policies and brochures for the footer.
--
-- One table, not two. An ISO logo and the certificate PDF behind it are one
-- thing to a visitor — the logo is the download — so a row carries an optional
-- logo and an optional file: logo only is a badge, file only is a download
-- link, both is a badge you can click.
--
-- Both media references are ON DELETE SET NULL, matching every other image
-- reference in the schema: deleting a file from the library must not take the
-- row with it, and the media router already warns before deleting anything
-- still in use.
CREATE TABLE "site_document" (
    "id"          TEXT NOT NULL,
    "logoId"      TEXT,
    "fileId"      TEXT,
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_document_translation" (
    "id"          TEXT NOT NULL,
    "documentId"  TEXT NOT NULL,
    "locale"      VARCHAR(5) NOT NULL,
    "label"       TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "site_document_translation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "site_document_isPublished_sortOrder_idx"
  ON "site_document"("isPublished", "sortOrder");

CREATE UNIQUE INDEX "site_document_translation_documentId_locale_key"
  ON "site_document_translation"("documentId", "locale");

CREATE INDEX "site_document_translation_locale_idx"
  ON "site_document_translation"("locale");

ALTER TABLE "site_document"
  ADD CONSTRAINT "site_document_logoId_fkey"
  FOREIGN KEY ("logoId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "site_document"
  ADD CONSTRAINT "site_document_fileId_fkey"
  FOREIGN KEY ("fileId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "site_document_translation"
  ADD CONSTRAINT "site_document_translation_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "site_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
