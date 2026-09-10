-- ============================================================================
-- Migration 114: The Grand Forum — search
-- ============================================================================
-- Postgres full-text over threads and replies. Generated columns, so the
-- vectors can never drift from the text, and GIN indexes so a query is a
-- lookup rather than a scan.
--
-- Weights: A title, B excerpt, C body. A search for "sadhana" should find
-- the topic called Sadhana before the one that mentions it in passing.
-- HTML tags are stripped before indexing — bodies are Tiptap HTML, and
-- without this every post matches "p", "strong" and "br".
--
-- The `events` audit log gets an index on (org_id, created_at) for the
-- per-org moderation log page, which had no supporting index.
-- ============================================================================

BEGIN;

ALTER TABLE threads ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', REGEXP_REPLACE(COALESCE(body, ''), '<[^>]*>', ' ', 'g')), 'C')
  ) STORED;

ALTER TABLE replies ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', REGEXP_REPLACE(COALESCE(content, ''), '<[^>]*>', ' ', 'g'))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_threads_search ON threads USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS idx_replies_search ON replies USING GIN (search_tsv);

-- Trigram index on titles, so a misspelled or partial title still finds it
-- when the tsquery returns nothing.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_threads_title_trgm ON threads USING GIN (title gin_trgm_ops);

COMMENT ON COLUMN threads.search_tsv IS
  'Generated: title (A) + excerpt (B) + de-tagged body (C). Feeds /search.';

-- The moderation log reads events by org, newest first.
CREATE INDEX IF NOT EXISTS idx_events_org_created ON events (org_id, created_at DESC);

COMMIT;
