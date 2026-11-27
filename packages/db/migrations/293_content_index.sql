-- ============================================================================
-- 293: content_index, the one search index behind @elkdonis/content searchContent
--      (docs/open/CONTENT_CORNERSTONE_2026-11-26/CONTRACT.md §3, §4, §10)
--
-- One row per piece: a thread (store 'thread'), an artwork (store 'artwork'),
-- and later a file (store 'file', Step 5; the file columns are nullable now).
-- Kept current by packages/services/src/content-index.ts, called from the
-- shared write paths, plus a backfill (scripts/content-reindex.mts) and a
-- reconcile. Rights are evaluated in SQL over these columns (server/access.ts
-- contentReadSql). The table is derived data: it can always be rebuilt.
--
-- tsv weights as 114_forum_search.sql: title A, excerpt B, body C (english).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS content_index (
  store             TEXT        NOT NULL CHECK (store IN ('thread', 'artwork', 'file')),
  id                TEXT        NOT NULL,
  key               TEXT        GENERATED ALWAYS AS (store || ':' || id) STORED,
  type              TEXT        NOT NULL,
  -- the owning org (threads.org_id; artwork: store.owner_org_id, NULL for a personal store)
  org_id            TEXT,
  -- the site the row lives on (threads.org_id; artwork: store.org_id, 'market')
  site_org_id       TEXT,
  store_id          UUID,
  owner_user_id     UUID,
  owner_identity_id UUID,
  visibility        TEXT        NOT NULL DEFAULT 'PUBLIC',
  min_role          TEXT,
  status            TEXT        NOT NULL,                    -- draft | published | archived
  sale_state        TEXT,
  price_minor       BIGINT,
  currency          TEXT,
  hidden            BOOLEAN     NOT NULL DEFAULT FALSE,
  title             TEXT        NOT NULL DEFAULT '',
  excerpt           TEXT,
  body_text         TEXT,
  tsv               TSVECTOR GENERATED ALWAYS AS (
                      setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
                      setweight(to_tsvector('english', COALESCE(excerpt, '')), 'B') ||
                      setweight(to_tsvector('english', COALESCE(body_text, '')), 'C')
                    ) STORED,
  sort_at           TIMESTAMPTZ NOT NULL,
  next_at           TIMESTAMPTZ,
  cover             TEXT,
  series_id         TEXT,
  -- file rows (Step 5); all nullable
  file_source       TEXT,
  file_path         TEXT,
  file_mime         TEXT,
  file_size         BIGINT,
  file_folder       TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store, id),
  CONSTRAINT content_index_key_uq UNIQUE (key)
);

CREATE INDEX IF NOT EXISTS idx_content_index_tsv        ON content_index USING GIN (tsv);
CREATE INDEX IF NOT EXISTS idx_content_index_title_trgm ON content_index USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_content_index_org_sort   ON content_index (org_id, sort_at DESC, (key COLLATE "C") DESC);
CREATE INDEX IF NOT EXISTS idx_content_index_site_sort  ON content_index (site_org_id, sort_at DESC, (key COLLATE "C") DESC);
CREATE INDEX IF NOT EXISTS idx_content_index_owner_sort ON content_index (owner_user_id, sort_at DESC, (key COLLATE "C") DESC);
CREATE INDEX IF NOT EXISTS idx_content_index_ident_sort ON content_index (owner_identity_id, sort_at DESC, (key COLLATE "C") DESC);
CREATE INDEX IF NOT EXISTS idx_content_index_store_id   ON content_index (store_id, sort_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_index_sort       ON content_index (sort_at DESC, (key COLLATE "C") DESC);

COMMENT ON TABLE content_index IS
  'Derived search index over threads, artwork (and later files). Rebuild with packages/content/scripts/content-reindex.mts.';
