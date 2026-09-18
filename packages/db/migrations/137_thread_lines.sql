-- ============================================================================
-- 137: thread_lines — a person draws a line between two threads.
--
-- The forum's map draws every kind of connection the network already has:
-- a thread gathers another (thread_gathers, deliberate, attributed to the
-- PAGE), a body mentions another (thread_references, derived from prose),
-- two threads share a tag (thread_topics). This adds the one kind it lacked:
-- a PERSON saying "these two belong together", without either page having
-- to agree.
--
-- Why not a row in thread_gathers: that table's unique key is
-- (thread_id, target_thread_id, relation) — one edge per pair per relation,
-- owned by the host thread's page. A line is owned by the person who drew
-- it, many people may draw the same one, and it belongs to neither page.
-- On a thread it shows only as a count ("3 people drew a line between
-- these"); in full it lives in the drawer's own profile space, as their map.
--
-- Undirected: the pair is stored ordered (a < b) so the same line drawn from
-- either end is the same row, and looked up from either end by one index.
-- ============================================================================
CREATE TABLE IF NOT EXISTS thread_lines (
  id           TEXT         PRIMARY KEY,
  user_id      UUID         NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  a_thread_id  TEXT         NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  b_thread_id  TEXT         NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  -- Why, in the drawer's words. Optional; shows on their map, not on the pages.
  note         TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT thread_lines_ordered CHECK (a_thread_id < b_thread_id),
  CONSTRAINT thread_lines_once    UNIQUE (user_id, a_thread_id, b_thread_id)
);

-- "Who drew a line from THIS thread" — read from either end.
CREATE INDEX IF NOT EXISTS idx_thread_lines_a ON thread_lines (a_thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_lines_b ON thread_lines (b_thread_id);
-- A person's own map, newest first.
CREATE INDEX IF NOT EXISTS idx_thread_lines_user ON thread_lines (user_id, created_at DESC);
