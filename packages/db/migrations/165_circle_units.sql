-- ============================================================================
-- 165: reading-circle plan units, and where each sitting stopped (2026-09-26)
-- ============================================================================
-- A reading circle is a `reading_group` thread (apps/fourthwayBookreaders).
-- Its sittings are the thread's occurrences, and what happened at one is a
-- `meeting_occurrence_notes` row (migrations 136, 159) — the same record IFAC
-- and InnerGathering keep for their standing meetings.
--
-- What was missing is the material itself, in order: the plan a circle works
-- through (issues of a periodical, chapters of a book, tracks of a recording),
-- and a record of where each sitting stopped so the next one starts there.
--
--   circle_units         one row per unit of material, in reading order.
--                        `length` is in `length_unit` (pages or seconds), so
--                        a stop point is a page within a document or a time
--                        within a recording. `source_path` is relative to the
--                        org's storage root (e.g. Private/Circles/<slug>/
--                        Material/totm012.pdf). `kind`, `status` and
--                        `length_unit` are vocabularies kept in application
--                        code, not CHECK constraints.
--
--   meeting_occurrence_notes.stop_unit_id / stop_position
--                        where the sitting ended: the unit, and the page or
--                        second within it. The circle's resume point is the
--                        latest occurrence that recorded one.
--
-- The `reading_*` tables of migration 043 are not reused: `reading_units`
-- hangs off `reading_programs`, which requires its own `reading_groups` and
-- `reading_books` rows — a second model beside the thread the site uses.
-- ============================================================================

CREATE TABLE IF NOT EXISTS circle_units (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       VARCHAR(50)   NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id    VARCHAR(21)   NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  position     INTEGER       NOT NULL,
  title        TEXT          NOT NULL,
  label        TEXT,
  kind         VARCHAR(20)   NOT NULL DEFAULT 'document',
  source_path  TEXT,
  length       INTEGER,
  length_unit  VARCHAR(10)   NOT NULL DEFAULT 'pages',
  target_on    DATE,
  status       VARCHAR(20)   NOT NULL DEFAULT 'planned',
  done_at      TIMESTAMPTZ,
  metadata     JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Not unique: reordering rewrites positions one row at a time.
CREATE INDEX IF NOT EXISTS idx_circle_units_thread ON circle_units (thread_id, position);
CREATE INDEX IF NOT EXISTS idx_circle_units_org ON circle_units (org_id);

ALTER TABLE meeting_occurrence_notes
  ADD COLUMN IF NOT EXISTS stop_unit_id  UUID REFERENCES circle_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stop_position INTEGER;

COMMENT ON TABLE circle_units IS
  'Reading-circle plan: units of material (issue, chapter, track) in order for a reading_group thread. length is in length_unit (pages|seconds); source_path is relative to the org storage root.';
COMMENT ON COLUMN meeting_occurrence_notes.stop_unit_id IS
  'Reading circles: the unit the sitting stopped in. With stop_position (page or second), the next sitting''s starting point.';
