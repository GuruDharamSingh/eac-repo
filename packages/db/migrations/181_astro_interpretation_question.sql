-- 181: interpretations started from a deck question. 2026-10-01.
-- ============================================================================
-- "Explain my thinking" on a deck question: the owner writes his answer or
-- description for a question (not a chart), and the reasoning worker proposes
-- chains for it exactly as for a chart interpretation. Such a row has
-- chart_id NULL, question_id set and factor_keys = the question's.
-- The worker's retrieved passages (all of them, not only those cited) are
-- kept in meta.references; the owner's marks on them are astro_reviews rows
-- with action 'ref-mark' (question_id NULL, ids in the payload).
-- ============================================================================

BEGIN;

ALTER TABLE astro_interpretations ALTER COLUMN chart_id DROP NOT NULL;
ALTER TABLE astro_interpretations
  ADD COLUMN IF NOT EXISTS question_id UUID REFERENCES astro_questions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS astro_interpretations_question_idx ON astro_interpretations (question_id) WHERE question_id IS NOT NULL;

COMMIT;
