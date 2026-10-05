-- 178: astro statements (corpus claims) and the reasoning explorer. 2026-09-28.
-- ============================================================================
-- (a) astro_statements / astro_statement_factors follow the digestion brief
--     (docs/open/ASTRO_DIGESTION_BRIEF_2026-09-27.md). The first producer is
--     the chunker pipeline's digest (Claude reading every interpretive chunk),
--     imported by packages/astro-corpus/scripts/import-chunker.ts:
--       body       = the claim restated to stand alone (a paraphrase, so
--                    start/end stay NULL)
--       certainty  = brief vocabulary (usually / may); the digest's own label
--                    is kept in meta.digestCertainty
--       frame      = {"zodiac": ...} of the book
--       register   = the digest's framing: psychological, predictive,
--                    spiritual, descriptive, technical
--       life_area  = house number 1-12 of the area of life, 0 = general
--       other_factors = concepts with no registry key ("South Node",
--                    "Saturn return", "ruler of the 7th in the 10th")
-- (b) The reasoning explorer: an owner writes an interpretation of a chart;
--     a worker (Claude via the owner's subscription, on the pipeline machine)
--     proposes alternative chains of reasoning that would lead to it; each
--     chain is a list of steps (observe a chart factor, cite a statement or
--     passage, infer, conclude). The owner's verdicts and comments on chains
--     and steps are astro_reviews rows (actions chain-pick, step-verdict,
--     step-add) with question_id NULL and the ids in the payload, so they
--     reach the same append-only history and export.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS astro_statements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           TEXT NOT NULL DEFAULT 'elastrocal' REFERENCES organizations(id) ON DELETE CASCADE,
  text_id          UUID NOT NULL REFERENCES astro_texts(id) ON DELETE CASCADE,
  ordinal          SMALLINT NOT NULL DEFAULT 0,          -- order within the text
  start            INTEGER,                              -- character offsets when the body is a quote
  "end"            INTEGER,
  body             TEXT NOT NULL,
  context          TEXT,                                 -- natal, transit, synastry, ... (brief)
  theme            TEXT,
  life_area        SMALLINT,
  valence          TEXT,
  certainty        TEXT,
  condition        TEXT,
  condition_keys   TEXT[] NOT NULL DEFAULT '{}',
  frame            JSONB NOT NULL DEFAULT '{}'::jsonb,
  register         TEXT,
  other_factors    TEXT[] NOT NULL DEFAULT '{}',
  labelled_by      TEXT NOT NULL,                        -- producer, e.g. 'chunker-digest'
  model            TEXT,
  meta             JSONB NOT NULL DEFAULT '{}'::jsonb,
  search           TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', body)) STORED,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (text_id, ordinal, labelled_by)
);
CREATE INDEX IF NOT EXISTS astro_statements_text_idx ON astro_statements (text_id);
CREATE INDEX IF NOT EXISTS astro_statements_search_idx ON astro_statements USING GIN (search);

CREATE TABLE IF NOT EXISTS astro_statement_factors (
  statement_id     UUID NOT NULL REFERENCES astro_statements(id) ON DELETE CASCADE,
  factor_key       TEXT NOT NULL REFERENCES astro_factors(key) ON DELETE CASCADE,
  role             TEXT NOT NULL DEFAULT 'subject',      -- subject, modifier, mentioned
  kind             TEXT,
  point            TEXT,
  other_point      TEXT,
  sign             TEXT,
  house            SMALLINT,
  aspect           TEXT,
  PRIMARY KEY (statement_id, factor_key)
);
CREATE INDEX IF NOT EXISTS astro_statement_factors_key_idx ON astro_statement_factors (factor_key);
CREATE INDEX IF NOT EXISTS astro_statement_factors_point_idx ON astro_statement_factors (point, kind);

CREATE TABLE IF NOT EXISTS astro_interpretations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           TEXT NOT NULL DEFAULT 'elastrocal' REFERENCES organizations(id) ON DELETE CASCADE,
  chart_id         UUID NOT NULL REFERENCES astro_charts(id) ON DELETE CASCADE,
  author_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body             TEXT NOT NULL,
  sentences        TEXT[] NOT NULL DEFAULT '{}',         -- the body split for display and targeting
  factor_keys      TEXT[] NOT NULL DEFAULT '{}',         -- the chart's factors when submitted
  status           TEXT NOT NULL DEFAULT 'queued',       -- queued, running, ready, failed
  error            TEXT,
  meta             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS astro_interpretations_status_idx ON astro_interpretations (status, created_at);
CREATE INDEX IF NOT EXISTS astro_interpretations_chart_idx ON astro_interpretations (chart_id);

CREATE TABLE IF NOT EXISTS astro_reasoning_chains (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interpretation_id UUID NOT NULL REFERENCES astro_interpretations(id) ON DELETE CASCADE,
  ordinal          SMALLINT NOT NULL,
  sentences        SMALLINT[] NOT NULL DEFAULT '{}',     -- indexes into astro_interpretations.sentences
  summary          TEXT NOT NULL,
  model            TEXT,
  prompt_version   TEXT,
  prompt_hash      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (interpretation_id, ordinal)
);

CREATE TABLE IF NOT EXISTS astro_reasoning_steps (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id         UUID NOT NULL REFERENCES astro_reasoning_chains(id) ON DELETE CASCADE,
  ordinal          SMALLINT NOT NULL,
  kind             TEXT NOT NULL,                        -- observe, cite, infer, conclude
  body             TEXT NOT NULL,
  based_on         SMALLINT[] NOT NULL DEFAULT '{}',     -- ordinals of the earlier steps this one rests on (the "why")
  factor_keys      TEXT[] NOT NULL DEFAULT '{}',
  statement_id     UUID REFERENCES astro_statements(id) ON DELETE SET NULL,
  text_id          UUID REFERENCES astro_texts(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chain_id, ordinal)
);

COMMIT;
