-- ============================================================================
-- 131: thread_gathers — what a thread holds.
--
-- The network had FIVE ways to group things and none of them knew about each
-- other: `thread_references` (thread→thread, written only by the wiki),
-- `documents[].ideaId` (a hand-rolled thread edge living inside a JSON array
-- in `site_config`), `thread_orgs` (cross-posting), `org_feeds` + `section`
-- (categories), and Nextcloud Deck (no Postgres row at all). This is the one
-- primitive they were each reaching for.
--
-- WHAT IT IS FOR. A group's week produces a meeting, the document written in
-- it, the terms defined out of that document, the discussion that followed,
-- and a couple of board cards. Those are five surfaces today and there is
-- nowhere that shows them as one occasion. This table is that edge: the
-- meeting thread GATHERS the rest, and its page renders them together.
--
-- NO CONTAINER OBJECT. The occasion already exists as a row — the meeting IS
-- the page — so any thread may gather, and nothing new has to be created or
-- indexed. A gathering is a forum topic because it is a thread, which is what
-- keeps the forum the single index of everything.
--
-- ── Why not just extend thread_references ──────────────────────────────────
--
-- Because that table is DERIVED and this one is not. `syncWikiLinks` does
--
--     DELETE FROM thread_references WHERE thread_id = $1
--
-- and rewrites a thread's whole edge set from its body on every save. An
-- attachment somebody placed by hand would be destroyed the next time anyone
-- edited the prose — silently, with no error and no way to notice. Mentions
-- are a re-derivable index of what the text says; gathering is a deliberate,
-- ordered, attributed act. Same shape, opposite lifecycles, separate tables.
--
-- ── Why the target is polymorphic ──────────────────────────────────────────
--
-- Two of the five things a group gathers are not rows in this database:
-- Deck cards live in Nextcloud, and living documents are entries in a JSON
-- array under `site_config.living_documents`. Both could become threads later
-- (`threads` already carries nextcloud_doc_url, document_url and
-- nextcloud_file_id for exactly that), and this table is written so that
-- promotion is an independent change: the edge survives it, because a
-- document referenced as ('document', '<id>') can be re-pointed at a real
-- thread row without the gathering model moving at all.
--
-- The `target_type = 'thread'` case keeps a real foreign key and cascades.
-- The external cases cannot, which is the honest cost of referencing things
-- that live somewhere else; readers must tolerate a target that has gone.
-- ============================================================================

CREATE TABLE IF NOT EXISTS thread_gathers (
  id               TEXT         PRIMARY KEY,

  -- The host: the thread whose page shows this. Always a real thread.
  thread_id        VARCHAR(21)  NOT NULL REFERENCES threads(id) ON DELETE CASCADE,

  -- The target, one of two ways.
  target_type      VARCHAR(20)  NOT NULL
                     CHECK (target_type IN ('thread','document','deck_card','deck_label','file','quote','link')),
  target_thread_id VARCHAR(21)  REFERENCES threads(id) ON DELETE CASCADE,
  -- Deck card id, DAV path, quote uuid, document id, or a URL. Opaque here.
  target_ref       TEXT,

  -- How the host relates to the target. Read in BOTH directions by one query
  -- each: the host's page lists what it gathers, the target's page says where
  -- it came from. See getWikiBacklinks for the pattern this follows.
  --
  --   gathers   this is part of the occasion (the default, and most rows)
  --   produced  the target came OUT of the host — the provenance edge
  --   talk      the target is the discussion OF the host
  --   cites     the host refers to the target without owning it
  relation         VARCHAR(20)  NOT NULL DEFAULT 'gathers'
                     CHECK (relation IN ('gathers','produced','talk','cites')),

  -- An override for how the row reads on the page. NULL means "use the
  -- target's own title", which is what almost every row wants.
  label            TEXT,

  -- Hand-ordered. The page is a composition, not a reverse-chronological
  -- list, so someone has to be able to put the minutes above the board.
  position         INTEGER      NOT NULL DEFAULT 0,

  added_by         UUID         REFERENCES users(id) ON DELETE SET NULL,
  added_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- A thread target uses the FK column and nothing else; every other kind of
  -- target uses the opaque one. Enforced so a reader never has to guess which
  -- field carries the answer for a given type.
  CONSTRAINT thread_gathers_target_shape CHECK (
    (target_type = 'thread' AND target_thread_id IS NOT NULL AND target_ref IS NULL)
    OR
    (target_type <> 'thread' AND target_thread_id IS NULL AND target_ref IS NOT NULL)
  ),

  -- A thread gathering itself would render as a page containing itself.
  CONSTRAINT thread_gathers_no_self CHECK (
    target_thread_id IS NULL OR target_thread_id <> thread_id
  )
);

-- The page's own read: everything this thread holds, in the order someone
-- put it in.
CREATE INDEX IF NOT EXISTS idx_thread_gathers_host
  ON thread_gathers (thread_id, position, added_at);

-- The reverse read — "where did this come from", "every meeting this term was
-- defined at". The whole provenance half of the feature is this index.
CREATE INDEX IF NOT EXISTS idx_thread_gathers_target
  ON thread_gathers (target_thread_id)
  WHERE target_thread_id IS NOT NULL;

-- Attaching the same thing twice is always a mistake rather than an intent,
-- but "the same thing" is spelled differently for the two target shapes, so
-- it takes two partial indexes. The relation is part of the key: a document
-- may legitimately be both gathered by and produced at the same meeting.
CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_gathers_unique_thread
  ON thread_gathers (thread_id, target_thread_id, relation)
  WHERE target_thread_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_gathers_unique_ref
  ON thread_gathers (thread_id, target_type, target_ref, relation)
  WHERE target_ref IS NOT NULL;
