-- ============================================================================
-- 156: submissions — a thread can be WAITING for a moderator, and an org can
-- choose whether members' posts wait at all.
--
-- The shape follows the forum's own topic review (forum-write.ts: proposed →
-- approved/rejected), lifted onto threads so every kind an org publishes can
-- go through the same gate rather than only forum topics.
--
--   status 'pending'      — written, not visible. Every read in the network
--                           filters `status = 'published'`, so a pending
--                           thread is already invisible everywhere without
--                           touching a single query.
--   organizations.member_posts_review
--                         — DEFAULT FALSE, deliberately: "anything by members
--                           can be posted" is the default the owner asked for
--                           (2026-09-19). An org that wants a queue turns this
--                           on; owners and guides are never held either way.
--   threads.reviewed_by / reviewed_at
--                         — who let it through (or turned it down), so the
--                           submissions list can say so afterwards.
--
-- A rejected submission becomes 'archived', the same resting place a removed
-- thread goes to (thread-admin.ts) — nothing is deleted, and a guide can put
-- it back.
-- ============================================================================

ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_status_check;
ALTER TABLE threads
  ADD CONSTRAINT threads_status_check
  CHECK (status IN ('draft', 'pending', 'published', 'archived'));

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS member_posts_review BOOLEAN NOT NULL DEFAULT FALSE;

-- The queue is read by org, newest first, and is tiny compared to the table.
CREATE INDEX IF NOT EXISTS idx_threads_pending
  ON threads (org_id, created_at DESC) WHERE status = 'pending';
