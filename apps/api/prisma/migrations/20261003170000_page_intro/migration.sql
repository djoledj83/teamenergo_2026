-- A short introduction under each page's title.
--
-- On page_translation rather than as a block: every section page has exactly
-- one intro, in the same place, and PageHero already had a dormant `lead`
-- slot waiting for it. A block would make it optional, orderable and
-- deletable, which is the wrong shape for something as fixed as a title.
--
-- Rich text, sanitised on write by the same richText() field every other body
-- column uses.
ALTER TABLE "page_translation" ADD COLUMN "intro" TEXT;
