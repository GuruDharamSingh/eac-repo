-- ============================================================================
-- Migration 188: threads.min_role (2026-10-03)
-- ============================================================================
-- The lowest role in the thread's org that may read it, for posts published to
-- a narrower audience than "everyone who follows". Stored together with
-- visibility = 'INVITE_ONLY' on purpose: every query written before this column
-- hides INVITE_ONLY rows from everyone but the author, so a row with a minimum
-- role fails closed in a query that has not learned about it. Queries that have
-- (packages/services/src/thread-access.ts, restrictedReadSql) additionally admit
-- viewers whose role in the org ranks at or above min_role.
--
--   NULL      no minimum (PUBLIC, ORGANIZATION, or author-only INVITE_ONLY)
--   viewer    followers and above
--   member    members, guides, owners
--   guide     guides and owners
--   owner     owners
-- ============================================================================

ALTER TABLE threads ADD COLUMN IF NOT EXISTS min_role VARCHAR(10);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'threads_min_role_check') THEN
    ALTER TABLE threads ADD CONSTRAINT threads_min_role_check
      CHECK (min_role IS NULL OR min_role IN ('viewer', 'member', 'guide', 'owner'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_threads_min_role ON threads (org_id, min_role) WHERE min_role IS NOT NULL;

COMMENT ON COLUMN threads.min_role IS
  'Lowest org role that may read this thread; set only with visibility INVITE_ONLY. NULL = no role-based audience.';
