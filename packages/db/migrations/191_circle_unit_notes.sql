-- ============================================================================
-- 191: thoughts left on a circle unit, and who finished it (2026-10-03)
-- ============================================================================
-- A reading circle's plan is `circle_units` (migration 165). The Akhand Path
-- (apps/fourthwayBookreaders, /akhand-path) uses one unit per passage of the
-- Guru Granth Sahib and reads them one or a few at a time, so two things are
-- recorded per unit rather than per sitting:
--
--   circle_unit_notes      a thought or comment a reader leaves on a unit.
--                          Soft-deleted (deleted_at) so a slip can be undone.
--
--   circle_units.done_by   who checked the unit off. done_at (165) already
--                          says when; the day's entry is the units whose
--                          done_at falls on that day.
-- ============================================================================

CREATE TABLE IF NOT EXISTS circle_unit_notes (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      VARCHAR(50)   NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id   VARCHAR(21)   NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  unit_id     UUID          NOT NULL REFERENCES circle_units(id) ON DELETE CASCADE,
  user_id     UUID          REFERENCES users(id) ON DELETE SET NULL,
  body        TEXT          NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_circle_unit_notes_unit ON circle_unit_notes (unit_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_circle_unit_notes_thread ON circle_unit_notes (thread_id, created_at) WHERE deleted_at IS NULL;

ALTER TABLE circle_units ADD COLUMN IF NOT EXISTS done_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_circle_units_done ON circle_units (thread_id, done_at) WHERE done_at IS NOT NULL;

COMMENT ON TABLE circle_unit_notes IS
  'Reading circles: a reader''s thought on one unit (an Akhand Path passage). Soft-deleted via deleted_at.';
COMMENT ON COLUMN circle_units.done_by IS
  'Who marked the unit done (with done_at, when).';
