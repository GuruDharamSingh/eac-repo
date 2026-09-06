-- ============================================================================
-- Migration 089: org-authored questionnaires — questions become data
-- ============================================================================
-- 088 gave wizard answers a home, but assumed the QUESTIONS live in code: the
-- two seeded questionnaires are validated by Zod schemas in
-- apps/arts-collective/src/lib/schema.ts. That works for wizards a developer
-- ships and not at all for a questionnaire an IFAC admin writes in the hub.
--
-- So `fields` becomes the question set, and a questionnaire gains an owner.
--
-- fields is a JSONB array, ordered, each entry:
--   { "key": "pick", "type": "choice", "label": "Which work should we hang?",
--     "options": ["Study in Red", "Nightwork"], "required": true }
--
--   type   text | longtext | choice | multichoice | image | number | boolean
--   key    stable identifier; becomes the key in questionnaire_responses.answers
--
-- "image" being just a field type is what gives image results without a second
-- system: the answer stores the uploaded URL like any other value.
--
-- On visibility — deliberately NO 'public' value. Questionnaire results are
-- never visible to anonymous visitors, by decision, not oversight. Sharing a
-- result outward is a future export/publish step that should be an explicit
-- act on a specific result, not a mode a questionnaire can quietly sit in.
--
--   admins   org owners/guides only — the default, and what the Elkdonis
--            vetting workbooks need
--   members  anyone with a role in the org may see the aggregate
--
-- On `key` staying the primary key: questionnaire_responses references it, and
-- a readable key is worth keeping. Org-authored questionnaires namespace
-- themselves as "<org_id>:<slug>" so they cannot collide with each other or
-- with the platform-level ones.
--
-- NOT done here: retiring question_polls / availability_polls. Their tables are
-- empty, but inner-gathering has ~2000 lines of working UI across 6 API routes
-- and 3 pages built on them. Consolidating onto this table means rewriting that
-- feature — a separate piece of work, not a side effect of this one.
-- ============================================================================

ALTER TABLE questionnaires
  -- NULL = platform-level (the Elkdonis wizards). Set = an org wrote it.
  ADD COLUMN IF NOT EXISTS org_id     VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fields     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS closes_at  TIMESTAMPTZ;

ALTER TABLE questionnaires
  ADD COLUMN IF NOT EXISTS results_visibility VARCHAR(20) NOT NULL DEFAULT 'admins';
ALTER TABLE questionnaires DROP CONSTRAINT IF EXISTS questionnaires_results_visibility_check;
ALTER TABLE questionnaires
  ADD CONSTRAINT questionnaires_results_visibility_check
  CHECK (results_visibility IN ('admins', 'members'));

-- draft: being written, not yet posed. open: accepting answers.
-- closed: answered set is final; results still readable.
ALTER TABLE questionnaires
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'open';
ALTER TABLE questionnaires DROP CONSTRAINT IF EXISTS questionnaires_status_check;
ALTER TABLE questionnaires
  ADD CONSTRAINT questionnaires_status_check
  CHECK (status IN ('draft', 'open', 'closed'));

-- A questionnaire an org wrote must say who wrote it; a platform one need not.
ALTER TABLE questionnaires DROP CONSTRAINT IF EXISTS questionnaires_org_authored_has_author;
ALTER TABLE questionnaires
  ADD CONSTRAINT questionnaires_org_authored_has_author
  CHECK (org_id IS NULL OR created_by IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_questionnaires_org
  ON questionnaires (org_id, sort_order) WHERE org_id IS NOT NULL;

COMMENT ON COLUMN questionnaires.fields IS
  'Ordered question definitions. Empty for the code-defined Elkdonis wizards.';
COMMENT ON COLUMN questionnaires.results_visibility IS
  'admins | members. Never public — sharing outward is a future explicit export.';
COMMENT ON COLUMN questionnaires.org_id IS
  'NULL = platform-level (Elkdonis wizards). Set = authored by that org.';

-- The two existing questionnaires are platform-level vetting workbooks: their
-- questions live in code (fields stays []), and their answers are private to
-- reviewers (results_visibility stays 'admins'). Both are already the defaults;
-- this only makes the intent explicit for anyone reading the table.
UPDATE questionnaires
SET results_visibility = 'admins', status = 'open'
WHERE org_id IS NULL;
