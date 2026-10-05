-- 186: book outlines — the section stamp on each imported passage. 2026-10-02.
-- ============================================================================
-- For the books that have an outline ($CORPUS_DIR/foundations/sections/
-- <book>.sections.json, imported by packages/astro-corpus/scripts/
-- import-foundations.ts), every imported passage (astro_texts, kind 'import',
-- matched by meta.docHash + meta.chunkIndex) gets the section it sits in:
--   kind          the kind of reading: general | natal | transit | progression |
--                 synastry | technique | example | other | front_back
--   title/chapter the section's title and its chapter
--   subject_type  element | sign | planet | house | planet_in_sign | … | none
--   subjects      what it is about, as the outline words it
--   silos         the Library silos it is filed in ("sign/capricorn",
--                 "placement/sign:jupiter:capricorn"), normalised from subjects
-- A side table (not astro_texts.meta) because the chunk importer rewrites
-- meta on re-import. The chart explorer uses `kind` to keep transit,
-- synastry and worked-example text out of a natal factor's main references.
-- astro_book_outlines keeps the outline itself for the Library's book pages.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS astro_text_sections (
  text_id      UUID PRIMARY KEY REFERENCES astro_texts(id) ON DELETE CASCADE,
  org_id       TEXT NOT NULL DEFAULT 'elastrocal' REFERENCES organizations(id) ON DELETE CASCADE,
  book_slug    TEXT NOT NULL,
  chunk_index  INTEGER NOT NULL,
  kind         TEXT NOT NULL,
  title        TEXT,
  chapter      TEXT,
  subject_type TEXT NOT NULL DEFAULT 'none',
  subjects     TEXT[] NOT NULL DEFAULT '{}',
  layout       TEXT,
  silos        TEXT[] NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS astro_text_sections_silos_idx ON astro_text_sections USING gin (silos);
CREATE INDEX IF NOT EXISTS astro_text_sections_book_idx ON astro_text_sections (org_id, book_slug, chunk_index);

CREATE TABLE IF NOT EXISTS astro_book_outlines (
  org_id       TEXT NOT NULL DEFAULT 'elastrocal' REFERENCES organizations(id) ON DELETE CASCADE,
  slug         TEXT NOT NULL,
  book         TEXT NOT NULL,
  doc_hash     TEXT NOT NULL,
  source_id    UUID,
  sections     JSONB NOT NULL DEFAULT '[]'::jsonb,
  stats        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, slug)
);

COMMIT;
