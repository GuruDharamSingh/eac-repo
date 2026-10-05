-- 185: the Library's own material. 2026-10-02.
-- ============================================================================
-- The Library (/hub/studio/library) is a read-only view of what has been
-- accumulated per subject ("silo"): keywords, reference passages and
-- correspondences come from the Foundations tables (183, 184). This table
-- holds the three kinds that had no home yet, imported by
-- packages/astro-corpus/scripts/import-foundations.ts from
-- $CORPUS_DIR/foundations/{outline,glossary,people}/<book-slug>.json:
--   kind = section   a book's section on one placement (Jupiter in Capricorn);
--                    silo = the factor key "sign:jupiter:capricorn",
--                    title = planet_in_sign | sun_in_sign | ascendant_sign,
--                    body = the text, payload {book, doc, chunks}
--   kind = glossary  a glossary term; title = the term, body = the definition,
--                    payload {book, also[], source}
--   kind = person    a famous person with a placement; title = the name,
--                    silo = the placement's factor key, payload {book, source}
-- Nothing here is reviewed, so a re-import replaces a book's entries.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS astro_library_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       TEXT NOT NULL DEFAULT 'elastrocal' REFERENCES organizations(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  book_slug    TEXT NOT NULL,
  entry_key    TEXT NOT NULL,
  silo         TEXT,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, kind, book_slug, entry_key)
);
CREATE INDEX IF NOT EXISTS astro_library_entries_silo_idx ON astro_library_entries (org_id, kind, silo);

COMMIT;
