-- 182: vocabulary cards for the owner to sort ("bedrock", step 1). 2026-10-01.
-- ============================================================================
-- Candidate astrological vocabulary (terms from the rulebook, the survey,
-- book terms and digest keywords), produced on the pipeline machine and
-- imported by packages/astro-corpus/scripts/import-vocab.ts (upsert by norm).
-- The owner sorts them one at a time in /hub/studio/vocabulary: his groups
-- become concept kinds, his renames and "same as" links the thesaurus. His
-- decisions are astro_reviews rows (question_id NULL, actions vocab-sort,
-- vocab-group, vocab-undo; src/vocab-rules.ts), so the cards themselves stay
-- the importer's and can be re-imported without losing a decision.
--   kind_hint / group_hint  the generator's suggestions; never pre-applied
--   sources                 [{source, detail}] where the term was found
--   books / uses            how many books use it, and how often
--   examples                [{text, book}] sentences showing it in use
--   also                    other spellings and forms
--   deck_order              1..n for the first deck, NULL after it
--   batch                   the import file it last came from
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS astro_vocab_cards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       TEXT NOT NULL DEFAULT 'elastrocal' REFERENCES organizations(id) ON DELETE CASCADE,
  norm         TEXT NOT NULL,
  term         TEXT NOT NULL,
  kind_hint    TEXT,
  group_hint   TEXT,
  sources      JSONB NOT NULL DEFAULT '[]'::jsonb,
  books        INTEGER NOT NULL DEFAULT 0,
  uses         INTEGER NOT NULL DEFAULT 0,
  examples     JSONB NOT NULL DEFAULT '[]'::jsonb,
  also         TEXT[] NOT NULL DEFAULT '{}',
  deck_order   INTEGER,
  batch        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, norm)
);
CREATE INDEX IF NOT EXISTS astro_vocab_cards_queue_idx ON astro_vocab_cards (org_id, deck_order NULLS LAST, books DESC, uses DESC);

COMMIT;
