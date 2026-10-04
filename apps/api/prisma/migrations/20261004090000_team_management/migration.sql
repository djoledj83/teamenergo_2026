-- Marks a team member as management, so the team page can lead with them in
-- a row of their own and list everyone else below.
--
-- A flag rather than a "role" or "department" column: the page makes exactly
-- one distinction, and a free-text grouping field would invite three spellings
-- of the same group and a layout that depends on matching them. Position
-- titles already live in the translated `role` field.
--
-- Defaults to false, so every existing member stays where they are until
-- somebody ticks the box.
ALTER TABLE "team_member" ADD COLUMN "isManagement" BOOLEAN NOT NULL DEFAULT false;

-- The page reads management first, then the rest, each by sort order.
CREATE INDEX "team_member_isManagement_sortOrder_idx"
  ON "team_member"("isManagement", "sortOrder");
