-- Publishing as an event, not a flag.
--
-- `threads.published_at` records that someone decided a piece was ready. It
-- does not produce anything: reading a "published" post still runs the same
-- database query and the same renderer as reading a draft, so publication is a
-- status column and nothing more.
--
-- Silex already established the other model on this platform and it works:
-- `organizations.silex_published_path` points at a static artifact in
-- Nextcloud, and `packages/silex-render` serves it — download, rewrite asset
-- URLs, apply manifest bindings, sanitize, render. One org has been served
-- that way since June.
--
-- These two columns give a thread the same treatment. At publish, the article
-- is rendered once through the binding engine and written to Nextcloud; from
-- then on the artifact is what readers get. Three consequences worth the
-- columns:
--
--   * Reading stops touching the database.
--   * What was published is fixed. Editing the thread does not silently
--     rewrite history under a reader; republishing is a deliberate act.
--   * The artifact is a file, so it can be backed up, mirrored, or handed to
--     someone whose site this platform no longer runs.
--
-- static_path: storage-relative, e.g.
--   EAC_Network/_published/<org>/<slug>/index.html
-- Network-level rather than inside an org's own tree, deliberately: a piece
-- cross-posted through `thread_orgs` belongs to several orgs and none of their
-- folders is the right home. The network is the publisher of record; custody
-- stays in the rows (threads.author_id + thread_orgs), not in which directory
-- holds the bytes.
--
-- NULL means "never published as an artifact", which is every row today. The
-- render path falls back to rendering from the database, so nothing breaks
-- before anything is published and nothing has to be backfilled.

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS static_path TEXT,
  ADD COLUMN IF NOT EXISTS static_published_at TIMESTAMPTZ;

-- Finding the artifact for a thread is a primary-key lookup; finding threads
-- that need republishing is the query worth an index — edited since the last
-- publish, or never published at all.
CREATE INDEX IF NOT EXISTS idx_threads_static_stale
  ON threads (org_id, updated_at)
  WHERE static_path IS NOT NULL;
