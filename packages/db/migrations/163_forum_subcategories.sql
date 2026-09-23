-- ============================================================================
-- 155: forum sub-categories, and a feed's link to a Nextcloud category.
--
-- The Nextcloud Forum app nests categories with `parentId`, and the user built
-- InnerGathering (8) › Marketing (9) there. The site had no way to represent
-- that: `org_feeds` was flat, and `org_nc_forum` mapped exactly ONE NC category
-- per org onto exactly ONE feed. Everything under that category was invisible
-- here — the topic moved into Marketing never arrived.
--
--   parent_slug     a feed inside another feed. NULL = top level, as before.
--   nc_category_id  which NC category this feed mirrors, when it mirrors one.
--
-- `nc_category_id` on the FEED generalises `org_nc_forum.site_feed_slug`, which
-- could only ever name one. That column stays: it still says which feed the
-- ROOT category lands in, and the backfill below copies it onto that feed.
--
-- The user's call (2026-09-23) was option B — mirror Nextcloud's tree
-- literally, so a child of the org's root category becomes a child of the feed
-- the root maps to (General › Marketing), rather than a sibling of it.
-- ============================================================================

ALTER TABLE org_feeds ADD COLUMN IF NOT EXISTS parent_slug VARCHAR(50);
ALTER TABLE org_feeds ADD COLUMN IF NOT EXISTS nc_category_id INTEGER;

-- A parent is a feed in the SAME org. Composite FK onto the real primary key,
-- so a parent cannot be invented and renaming is not silently lost.
-- ON DELETE SET NULL: deleting a parent promotes its children to top level
-- rather than cascading away a category's worth of conversation.
DO $$
BEGIN
  ALTER TABLE org_feeds
    ADD CONSTRAINT org_feeds_parent_fk
    FOREIGN KEY (org_id, parent_slug) REFERENCES org_feeds (org_id, slug)
    ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- A feed cannot be its own parent. Deeper cycles are prevented in the sync,
-- which builds the tree from Nextcloud's own parentId and cannot invent one,
-- and by the renderer, which stops descending at a depth bound.
DO $$
BEGIN
  ALTER TABLE org_feeds
    ADD CONSTRAINT org_feeds_parent_not_self CHECK (parent_slug IS NULL OR parent_slug <> slug);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- One NC category maps to at most one feed, network-wide. Partial, so the many
-- feeds that mirror nothing are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS org_feeds_nc_category
  ON org_feeds (nc_category_id) WHERE nc_category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS org_feeds_parent ON org_feeds (org_id, parent_slug)
  WHERE parent_slug IS NOT NULL;

-- Backfill: the feed each org's ROOT category already lands in now says so.
-- Without this the sync would see the root as unmapped and try to create a
-- second feed beside the one already holding that category's topics.
UPDATE org_feeds f
SET nc_category_id = n.nc_category_id
FROM org_nc_forum n
WHERE f.org_id = n.org_id
  AND f.slug = n.site_feed_slug
  AND f.nc_category_id IS DISTINCT FROM n.nc_category_id;
