-- 184: the correspondence table of the Foundations section. 2026-10-02.
-- ============================================================================
-- What the books give for a subject (the sign Aries, the planet Mars, the
-- element fire, a house, a mode…) under a category (Color, Gems, Body Part,
-- "Keywords (list)"…): one row per value, per book. Correspondences sit in
-- this one table rather than each being a term. Imported by
-- packages/astro-corpus/scripts/import-foundations.ts from
-- $CORPUS_DIR/foundations/correspondences/<book-slug>.json (upsert by the
-- file's stable id within the book), so another book's values for the same
-- subject + category sit side by side. Reviewed in
-- /hub/studio/foundations/correspondences; the owner's decisions are
-- astro_reviews rows (foundation-cell-verdict, foundation-cell-add,
-- foundation-category, foundation-category-add; src/foundations-rules.ts).
--   book_slug   the book the value comes from ("owner" for the owner's own)
--   cell_key    the file's stable id ("own-…" for the owner's)
--   payload     {page, source, derived_from, book, author}
--   stale       a later file no longer has the row but the owner had judged it
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS astro_correspondences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       TEXT NOT NULL DEFAULT 'elastrocal' REFERENCES organizations(id) ON DELETE CASCADE,
  book_slug    TEXT NOT NULL,
  cell_key     TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject      TEXT NOT NULL,
  category     TEXT NOT NULL,
  value        TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  position     INTEGER NOT NULL DEFAULT 0,
  origin       TEXT NOT NULL DEFAULT 'books',
  stale        BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, book_slug, cell_key)
);
CREATE INDEX IF NOT EXISTS astro_correspondences_subject_idx ON astro_correspondences (org_id, subject_type, subject, category);

COMMIT;
