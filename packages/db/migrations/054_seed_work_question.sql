-- ============================================================================
-- Migration 054: Seed active work question for inner_group
-- ============================================================================
-- The inner-gathering /feed renders WorkQuestionBox, which hides itself when
-- there is no active work_questions row for org_id='inner_group'. Migration 049
-- seeds one, but that INSERT only runs once and won't restore the row if the
-- table is later wiped (same class of bug as the empty organizations table).
--
-- This guard-insert restores an active question only when none exists, so it is
-- safe to run on any database and never creates duplicates or overwrites an
-- admin-edited question.
-- ============================================================================

INSERT INTO work_questions (org_id, question, is_active)
SELECT 'inner_group', 'What is Art For?', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM work_questions WHERE org_id = 'inner_group' AND is_active = TRUE
);
