-- 176: astro_texts.meta, per-text provenance for imported book chunks. 2026-09-27.
-- ============================================================================
-- Book chunks imported from the chunker pipeline (packages/astro-corpus
-- scripts/import-chunker.ts) carry their place in the book: chunk index,
-- headings, physical PDF pages, token count, normalised-text hash, zodiac,
-- tagger version. Other texts leave it empty.
-- ============================================================================

BEGIN;

ALTER TABLE astro_texts ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS astro_texts_norm_hash_idx ON astro_texts ((meta->>'normHash')) WHERE meta ? 'normHash';

COMMIT;
