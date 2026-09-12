-- ============================================================================
-- 118 — Wiki pages
-- ============================================================================
-- A wiki page is a `threads` row with kind='wiki_page' — the workshop_pages /
-- pigeon precedent (migrations 038, 077): threads already carries slug,
-- org-scoping, UNIQUE(org_id, slug), title, body and author. `kind` has had
-- no CHECK constraint since migration 097 (app-validated, data-not-DDL), so
-- adding this kind needs no DDL of its own.
--
-- What a wiki page needs that no other kind so far has: a per-save edit
-- history. Posts and workshops are single-author; a wiki page is meant to be
-- edited by anyone with standing in the org, so "who changed this and what
-- did it say before" is load-bearing, not a nice-to-have.
--
-- NOT reusing `thread_revisions` (migration 031): that table already exists
-- and is a sparse kind-transition audit log — one JSONB snapshot of the whole
-- row, written only when a thread's `kind` changes (see
-- apps/inner-gathering's /api/content route, its only writer). A wiki needs
-- the opposite shape: a dense row on every save, keyed on title/body rather
-- than a generic snapshot. Separately: the live `thread_revisions` table's
-- actual columns (`changed_at`, `changed_by`, `text` ids) don't match what
-- migration 031's file describes (`created_at`, `VARCHAR(21)` with a default)
-- even though `--verify` reports no checksum drift — it was altered by hand
-- outside the migration system at some point. Not this migration's problem to
-- fix, but it's why colliding with that table was worth avoiding rather than
-- discovering at read time.
--
-- wiki_revisions stores a full content snapshot per save (not a diff — cheap
-- to build, cheap enough to store at collective scale, and a revert is just
-- "copy this snapshot back", itself recorded as a new revision rather than a
-- destructive rewrite).
-- ============================================================================

CREATE TABLE IF NOT EXISTS wiki_revisions (
  id          VARCHAR(21)  PRIMARY KEY,
  thread_id   VARCHAR(21)  NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  editor_id   UUID         NOT NULL REFERENCES users(id),
  title       TEXT         NOT NULL,
  body        TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wiki_revisions_thread
  ON wiki_revisions (thread_id, created_at DESC);

COMMENT ON TABLE wiki_revisions IS
  'Full-snapshot edit history for wiki pages (threads.kind=''wiki_page''). One row per save, including the row written at page creation.';

COMMENT ON COLUMN threads.kind IS
  'post | meeting | workshop | event | service | product | pigeon | wiki_page. App-validated (data-not-DDL, per 073/091/093/097) — adding a kind should not need a migration.';
