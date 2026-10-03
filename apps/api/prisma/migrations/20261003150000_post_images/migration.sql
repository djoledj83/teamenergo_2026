-- An ordered gallery of library images on an article, so a piece of news can
-- carry more than one photograph.
--
-- Deliberately the same shape as project_image: the admin editor and the
-- public lightbox are shared between the two, and they can only be shared if
-- the tables agree.
--
-- ON DELETE CASCADE on mediaId, matching project_image: this row is an
-- attachment, not a reference to preserve, so removing the file from the
-- library removes it from the article rather than leaving a dangling id. The
-- media router still warns before deleting anything that is in use.
CREATE TABLE "post_image" (
    "id"        TEXT NOT NULL,
    "postId"    TEXT NOT NULL,
    "mediaId"   TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_image_pkey" PRIMARY KEY ("id")
);

-- Re-attaching the same photo is a no-op rather than a duplicate tile.
CREATE UNIQUE INDEX "post_image_postId_mediaId_key" ON "post_image"("postId", "mediaId");

CREATE INDEX "post_image_postId_sortOrder_idx" ON "post_image"("postId", "sortOrder");

ALTER TABLE "post_image"
  ADD CONSTRAINT "post_image_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "post_image"
  ADD CONSTRAINT "post_image_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
