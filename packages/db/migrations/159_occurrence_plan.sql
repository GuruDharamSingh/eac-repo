-- ============================================================================
-- 159: what a given week is COVERING.
--
-- `meeting_occurrence_notes` already holds what happened at an occurrence
-- (`note`, written afterwards, with the attendance). A rota needs the other
-- half: what the next one is FOR — the reading, the piece being looked at,
-- the topic. The owner asked for it beside the host on the Plan ahead popup
-- (2026-09-21).
--
-- Same row, new column, rather than a table of its own: it is keyed by exactly
-- the same pair (thread, occurrence), and the planner and the record are two
-- ends of one week. A row may now exist with a plan and no note (nothing has
-- happened yet), which is why nothing here is NOT NULL.
-- ============================================================================

ALTER TABLE meeting_occurrence_notes
  ADD COLUMN IF NOT EXISTS plan TEXT,
  ADD COLUMN IF NOT EXISTS planned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS planned_at TIMESTAMPTZ;
