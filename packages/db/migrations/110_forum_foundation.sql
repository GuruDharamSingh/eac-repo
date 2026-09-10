-- ============================================================================
-- Migration 110: The Grand Forum — foundation
-- ============================================================================
-- Two things every forum page needs before any interaction exists
-- (GRAND_FORUM_PLAN.md §3; read state, votes and taxonomy follow in 111).
--
-- (a) threads.last_activity_at. Migration 030 declared it in its
--     CREATE TABLE IF NOT EXISTS, but the table already existed from the
--     schemas.ts baseline, so the CREATE was a no-op and the column never
--     landed — along with time_zone, tags, attachments and co_host_ids.
--     It is the "Active" sort and the "last post" column, so it is added
--     here for real, backfilled from the newest reply or the publish date,
--     and kept current by createReply (packages/db/src/queries/forum.ts).
--
-- (b) A `general` feed for every org. A classic board needs every thread
--     to have a home forum; 24 of inner_group's 29 threads have none.
--     Sectionless threads move into it. New orgs get theirs from the same
--     INSERT re-run by whatever provisions them (or lazily: the forum's
--     read layer treats NULL section as 'general').
-- ============================================================================

BEGIN;

-- (a) ----------------------------------------------------------------------
ALTER TABLE threads ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

UPDATE threads t
SET last_activity_at = GREATEST(
  COALESCE(t.published_at, t.created_at),
  COALESCE((SELECT MAX(r.created_at) FROM replies r WHERE r.thread_id = t.id), t.created_at)
)
WHERE t.last_activity_at IS NULL;

ALTER TABLE threads ALTER COLUMN last_activity_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_threads_last_activity
  ON threads (last_activity_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_threads_feed_activity
  ON threads (org_id, section, last_activity_at DESC) WHERE status = 'published';

COMMENT ON COLUMN threads.last_activity_at IS
  'Newest of publish time and last reply. Forum "Active" sort and "last post" column. Bumped by createReply.';

-- (b) ----------------------------------------------------------------------
INSERT INTO org_feeds (org_id, slug, name, tagline, sort_order, is_public)
SELECT o.id, 'general', 'General', 'Everything that has no other home', 999, TRUE
FROM organizations o
ON CONFLICT (org_id, slug) DO NOTHING;

UPDATE threads SET section = 'general' WHERE section IS NULL;

COMMIT;
