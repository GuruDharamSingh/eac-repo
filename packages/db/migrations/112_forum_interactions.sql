-- ============================================================================
-- Migration 112: The Grand Forum — interactions
-- ============================================================================
-- GRAND_FORUM_PLAN.md §3, phase 2. (111 went to the marketplace.)
--
-- (a) Read state. One row per (user, thread) written when a thread is
--     opened; "mark all read" is a watermark on users, not N rows.
--       unread := last_activity_at > GREATEST(thread_reads.last_read_at,
--                                             users.forum_read_all_at)
--
-- (b) Votes ride on `reactions`. `kind` becomes one of like | up | down;
--     the heart is independent of the vote, up and down are exclusive per
--     person per target. Scores are denormalised onto threads / replies
--     (vote_score) next to the existing reaction_count (= hearts), and
--     maintained by the services write layer, as reaction_count already is.
--
-- (c) Taxonomy governance. Org owners/guides propose topics; a global admin
--     approves. A proposed topic is usable by its origin org at once and
--     joins the global index on approval.
-- ============================================================================

BEGIN;

-- (a) ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS thread_reads (
  user_id            UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id          VARCHAR(21)  NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  last_read_reply_id VARCHAR(21)  REFERENCES replies(id) ON DELETE SET NULL,
  last_read_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, thread_id)
);
CREATE INDEX IF NOT EXISTS idx_thread_reads_user ON thread_reads (user_id, last_read_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS forum_read_all_at TIMESTAMPTZ;

COMMENT ON TABLE thread_reads IS
  'Forum read state: where each person last got to in each thread. Unread = thread.last_activity_at newer than this (or than users.forum_read_all_at).';

-- (b) ----------------------------------------------------------------------
-- Anything that isn't a heart or a vote was an earlier experiment; fold it
-- into hearts rather than lose it.
UPDATE reactions SET kind = 'like' WHERE kind NOT IN ('like', 'up', 'down');

ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_kind_check;
ALTER TABLE reactions ADD CONSTRAINT reactions_kind_check CHECK (kind IN ('like', 'up', 'down'));

-- One vote (up OR down) per person per target. The per-kind uniqueness the
-- table already carries stays; this adds the cross-kind rule.
CREATE UNIQUE INDEX IF NOT EXISTS reactions_one_vote_thread
  ON reactions (thread_id, user_id) WHERE reply_id IS NULL AND kind IN ('up', 'down');
CREATE UNIQUE INDEX IF NOT EXISTS reactions_one_vote_reply
  ON reactions (reply_id, user_id) WHERE reply_id IS NOT NULL AND kind IN ('up', 'down');

ALTER TABLE threads ADD COLUMN IF NOT EXISTS vote_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS vote_score INTEGER NOT NULL DEFAULT 0;

-- Backfill both counters from the rows, so they are trustworthy from here on.
UPDATE threads t SET
  reaction_count = (SELECT COUNT(*) FROM reactions r WHERE r.thread_id = t.id AND r.reply_id IS NULL AND r.kind = 'like'),
  vote_score     = (SELECT COALESCE(SUM(CASE r.kind WHEN 'up' THEN 1 WHEN 'down' THEN -1 ELSE 0 END), 0)
                    FROM reactions r WHERE r.thread_id = t.id AND r.reply_id IS NULL);
UPDATE replies p SET
  reaction_count = (SELECT COUNT(*) FROM reactions r WHERE r.reply_id = p.id AND r.kind = 'like'),
  vote_score     = (SELECT COALESCE(SUM(CASE r.kind WHEN 'up' THEN 1 WHEN 'down' THEN -1 ELSE 0 END), 0)
                    FROM reactions r WHERE r.reply_id = p.id);

COMMENT ON COLUMN threads.vote_score IS 'ups minus downs on the thread itself (reactions with reply_id IS NULL). reaction_count stays = hearts.';
COMMENT ON COLUMN replies.vote_score IS 'ups minus downs on this reply. reaction_count stays = hearts.';

-- (c) ----------------------------------------------------------------------
ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS status      VARCHAR(12) NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS proposed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS org_id      VARCHAR(50) REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_status_check;
ALTER TABLE topics ADD CONSTRAINT topics_status_check CHECK (status IN ('proposed', 'approved', 'rejected'));
CREATE INDEX IF NOT EXISTS idx_topics_status ON topics (status);

COMMENT ON COLUMN topics.org_id IS 'Origin org of a proposed topic (NULL = network-level). Usable by that org while proposed; global once approved.';

COMMIT;
