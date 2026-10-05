-- 179: a source snapshot on reasoning steps. 2026-09-28.
-- ============================================================================
-- Cite steps point at astro_statements / astro_texts when the cited book has
-- been imported into the studio. The worker also stores what it cited, so a
-- step still shows its evidence before (or without) that import:
--   {"chunkId", "docHash", "book", "author", "pages": [..], "headings": [..],
--    "statement": "...", "excerpt": "..."}
-- ============================================================================

BEGIN;

ALTER TABLE astro_reasoning_steps ADD COLUMN IF NOT EXISTS source JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
