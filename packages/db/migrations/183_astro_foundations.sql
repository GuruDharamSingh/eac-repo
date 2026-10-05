-- 183: "Foundations" — one basic idea at a time, read from a small shelf. 2026-10-02.
-- ============================================================================
-- The owner restarts the training from the basics: a lesson (first: the four
-- elements) has a few concepts (fire, earth, air, water). A local model reads
-- every place the shelf's books name a concept and notes the qualities
-- ("trait"), the pictures and metaphors ("image") and the teaching passages
-- ("passage"). scripts/import-foundations.ts imports that sheet
-- ($CORPUS_DIR/foundations/<lesson>/sheet.json, upsert by item_key).
-- The owner reviews it in /hub/studio/foundations. His decisions are
-- astro_reviews rows (question_id NULL; actions foundation-define,
-- foundation-verdict, foundation-merge, foundation-correct, foundation-add,
-- foundation-undo; src/foundations-rules.ts), keyed by the item's row id, so
-- the items stay the importer's and can be re-imported without losing a
-- decision.
--   astro_foundation_lessons
--     shelf      [{doc, book, mentions}] the books read for the lesson
--     concepts   [{id, label, stats{mentions, books, by_role, by_mode, not_element}}]
--   astro_foundation_items
--     item_key   the sheet's stable id ("own-…" for an item the owner added)
--     kind       trait | image | passage | note (note: only the owner's)
--     payload    {meaning, role, mode, sources[{mention, book, author, where,
--                pages, quote, context, role, mode}]}
--     origin     books | owner
--     payload    also {facet: itself | lack | excess}; sources also carry
--                {facet, why, reader}
--     stale      true when a later sheet no longer has the item but the owner
--                had already reviewed it (unreviewed ones are removed)
--   astro_foundation_catalogues / astro_foundation_terms
--     "Basic terms, book by book": one book's catalogue of basic terms
--     ($CORPUS_DIR/foundations/catalogue/<book-slug>.json), reviewed in
--     /hub/studio/foundations/terms (actions foundation-term-*).
--     grp        element | mode | polarity | … | other
--     payload    {facet, code, keywords[], secondary[], definition,
--                how_to_weigh, figure, related[], pages[], quote, note}
--     position   the term's place in the file
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS astro_foundation_lessons (
  org_id       TEXT NOT NULL DEFAULT 'elastrocal' REFERENCES organizations(id) ON DELETE CASCADE,
  lesson       TEXT NOT NULL,
  title        TEXT NOT NULL,
  version      TEXT,
  shelf        JSONB NOT NULL DEFAULT '[]'::jsonb,
  concepts     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, lesson)
);

CREATE TABLE IF NOT EXISTS astro_foundation_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       TEXT NOT NULL DEFAULT 'elastrocal' REFERENCES organizations(id) ON DELETE CASCADE,
  lesson       TEXT NOT NULL,
  concept      TEXT NOT NULL,
  kind         TEXT NOT NULL,
  item_key     TEXT NOT NULL,
  text         TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  books        INTEGER NOT NULL DEFAULT 0,
  uses         INTEGER NOT NULL DEFAULT 0,
  version      TEXT,
  origin       TEXT NOT NULL DEFAULT 'books',
  stale        BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, lesson, item_key)
);
CREATE INDEX IF NOT EXISTS astro_foundation_items_concept_idx ON astro_foundation_items (org_id, lesson, concept, kind, books DESC, uses DESC);

CREATE TABLE IF NOT EXISTS astro_foundation_catalogues (
  org_id       TEXT NOT NULL DEFAULT 'elastrocal' REFERENCES organizations(id) ON DELETE CASCADE,
  slug         TEXT NOT NULL,
  book         TEXT NOT NULL,
  author       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, slug)
);

CREATE TABLE IF NOT EXISTS astro_foundation_terms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       TEXT NOT NULL DEFAULT 'elastrocal' REFERENCES organizations(id) ON DELETE CASCADE,
  book_slug    TEXT NOT NULL,
  term_key     TEXT NOT NULL,
  term         TEXT NOT NULL,
  grp          TEXT NOT NULL DEFAULT 'other',
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  position     INTEGER NOT NULL DEFAULT 0,
  stale        BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, book_slug, term_key)
);
CREATE INDEX IF NOT EXISTS astro_foundation_terms_book_idx ON astro_foundation_terms (org_id, book_slug, position);

COMMIT;
