-- 167: Astro Studio corpus tables (factors, sources, texts, questions, reviews). 2026-09-26.
-- ============================================================================
-- The corpus behind Elastrocal's review studio and the astrologer-AI dataset.
-- Design: docs/open/ASTRO_STUDIO_BRIEF_2026-09-26.md. Code: packages/astro-corpus.
--
--   (a) astro_factors mirrors the registry generated in
--       packages/astro-corpus/src/factors.ts (seeded by its seed:factors
--       script). The key is the join key for everything else.
--   (b) Every text has a source; the source carries the licence, and
--       `trainable` is what the export filters on.
--   (c) Reviews are append-only: a change of mind is a new row, so the
--       history of judgements is itself data.
--   (d) Vocabularies (text kinds, question types, review actions, traditions)
--       are plain text columns, validated in code, not CHECK constraints.
--   (e) org_id defaults to 'elastrocal' (migration 117) to follow the
--       network's tenancy convention; nothing else in the network reads these
--       tables.
--   (f) No vector column yet: the postgres:16-alpine image has no pgvector
--       (checked 2026-09-26). Retrieval starts with factor keys and the
--       generated tsvector below.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS astro_factors (
  key              TEXT PRIMARY KEY,
  kind             TEXT NOT NULL,
  label            TEXT NOT NULL,
  parts            JSONB NOT NULL DEFAULT '{}'::jsonb,
  point_group      TEXT NOT NULL,
  generational     BOOLEAN NOT NULL DEFAULT false,
  minor            BOOLEAN NOT NULL DEFAULT false,
  impossible       BOOLEAN NOT NULL DEFAULT false,
  unobserved       BOOLEAN NOT NULL DEFAULT false,
  book_group       TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS astro_factors_kind_idx ON astro_factors (kind);

CREATE TABLE IF NOT EXISTS astro_sources (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           TEXT NOT NULL DEFAULT 'elastrocal' REFERENCES organizations(id) ON DELETE CASCADE,
  -- Stable handle for re-imports: "hf:ocaklisemih/astrology_dialogs".
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  author           TEXT,
  -- book | dataset | compilation | own | generated | engine
  kind             TEXT NOT NULL,
  -- SPDX id, or 'unknown' / 'all-rights-reserved' / 'owner'
  licence          TEXT NOT NULL DEFAULT 'unknown',
  trainable        BOOLEAN NOT NULL DEFAULT false,
  url              TEXT,
  notes            TEXT,
  meta             JSONB NOT NULL DEFAULT '{}'::jsonb,
  importer         TEXT,
  imported_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  imported_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS astro_texts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           TEXT NOT NULL DEFAULT 'elastrocal' REFERENCES organizations(id) ON DELETE CASCADE,
  source_id        UUID NOT NULL REFERENCES astro_sources(id) ON DELETE CASCADE,
  -- Position in the source (row index, passage id), for idempotent re-import.
  source_ref       TEXT,
  -- import | own | engine | generated | edit
  kind             TEXT NOT NULL,
  tradition        TEXT,
  author           TEXT,
  body             TEXT NOT NULL,
  -- A chunk of a longer passage points at the passage.
  parent_id        UUID REFERENCES astro_texts(id) ON DELETE CASCADE,
  -- Generated texts: which model, which prompt, which sources it was shown.
  model            TEXT,
  prompt_hash      TEXT,
  generated_from   JSONB,
  -- Edited texts: the candidate the edit started from.
  derived_from     UUID REFERENCES astro_texts(id) ON DELETE SET NULL,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  search           TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', body)) STORED,
  UNIQUE (source_id, source_ref)
);
CREATE INDEX IF NOT EXISTS astro_texts_search_idx ON astro_texts USING GIN (search);
CREATE INDEX IF NOT EXISTS astro_texts_kind_idx ON astro_texts (kind);

CREATE TABLE IF NOT EXISTS astro_text_factors (
  text_id          UUID NOT NULL REFERENCES astro_texts(id) ON DELETE CASCADE,
  factor_key       TEXT NOT NULL REFERENCES astro_factors(key) ON DELETE CASCADE,
  -- primary | mentioned
  role             TEXT NOT NULL DEFAULT 'primary',
  -- explicit | inferred | human
  confidence       TEXT NOT NULL DEFAULT 'explicit',
  PRIMARY KEY (text_id, factor_key)
);
CREATE INDEX IF NOT EXISTS astro_text_factors_factor_idx ON astro_text_factors (factor_key);

CREATE TABLE IF NOT EXISTS astro_questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           TEXT NOT NULL DEFAULT 'elastrocal' REFERENCES organizations(id) ON DELETE CASCADE,
  -- interpret | modify | combine | compare | correct | ask | tag
  type             TEXT NOT NULL,
  prompt           TEXT NOT NULL,
  factor_keys      TEXT[] NOT NULL DEFAULT '{}',
  chart_id         UUID REFERENCES astro_charts(id) ON DELETE SET NULL,
  tradition        TEXT,
  priority         REAL NOT NULL DEFAULT 0,
  -- open | done | skipped | flagged | archived
  status           TEXT NOT NULL DEFAULT 'open',
  -- import | helper | studio | chart
  origin           TEXT NOT NULL,
  source_id        UUID REFERENCES astro_sources(id) ON DELETE SET NULL,
  source_ref       TEXT,
  -- The dataset's own wording when the prompt was rewritten on import.
  original         TEXT,
  meta             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, source_ref)
);
CREATE INDEX IF NOT EXISTS astro_questions_queue_idx ON astro_questions (status, priority DESC);
CREATE INDEX IF NOT EXISTS astro_questions_factors_idx ON astro_questions USING GIN (factor_keys);

CREATE TABLE IF NOT EXISTS astro_candidates (
  question_id      UUID NOT NULL REFERENCES astro_questions(id) ON DELETE CASCADE,
  text_id          UUID NOT NULL REFERENCES astro_texts(id) ON DELETE CASCADE,
  added_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, text_id)
);
CREATE INDEX IF NOT EXISTS astro_candidates_text_idx ON astro_candidates (text_id);

CREATE TABLE IF NOT EXISTS astro_reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           TEXT NOT NULL DEFAULT 'elastrocal' REFERENCES organizations(id) ON DELETE CASCADE,
  question_id      UUID REFERENCES astro_questions(id) ON DELETE CASCADE,
  reviewer_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- pick | rate | fix | mark | tag | write | skip | flag
  action           TEXT NOT NULL,
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  candidate_ids    UUID[] NOT NULL DEFAULT '{}',
  -- The order the candidates were shown in (pairwise choices lean to one side).
  shown_order      UUID[] NOT NULL DEFAULT '{}',
  -- preference | claim
  stance           TEXT,
  seconds          REAL,
  device           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS astro_reviews_question_idx ON astro_reviews (question_id);
CREATE INDEX IF NOT EXISTS astro_reviews_reviewer_idx ON astro_reviews (reviewer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS astro_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           TEXT NOT NULL DEFAULT 'elastrocal' REFERENCES organizations(id) ON DELETE CASCADE,
  path             TEXT NOT NULL,
  manifest         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  exported_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
