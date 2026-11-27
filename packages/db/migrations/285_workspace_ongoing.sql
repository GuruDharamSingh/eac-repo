-- 285_workspace_ongoing.sql
-- Workspace slice 4a: the ongoing session (docs/open/DEVELOPMENT_APP_2026-11-20/workspace-threads.md, sections 2, 3, 7).
-- ADDITIVE ONLY: two nullable columns on existing tables, one partial unique index, two new tables. No existing row changes,
-- no existing constraint changes, nothing an ordinary course reads or writes.
--
--   lms_enrolments.tz            the zone the browser reported for this seat (the writer's own day); NULL = America/Toronto
--   lms_responses.interval_key   "YYYY-MM-DD", the first local day of the interval an entry answers; NULL for every ordinary response
--   workspace_cadences           a repeating rhythm on a host (one per ongoing session)
--   workspace_materials          a note and material per host and scope, optionally per interval (the role meeting_occurrence_notes plays for meetings)
--
-- Hosts are keyed (host_type, host_id) so a thread can host a circle later without a rewrite. Today host_type is 'lms_run'.
-- The code treats ongoing sessions as absent until these exist (it tests for the table and columns).
--
-- NOT APPLIED by the worker who wrote it: the PM applies migrations.

ALTER TABLE lms_enrolments ADD COLUMN IF NOT EXISTS tz VARCHAR(64);
ALTER TABLE lms_responses  ADD COLUMN IF NOT EXISTS interval_key VARCHAR(10);

-- One entry per person per interval (edited in place). Only rows that have a key take part, so every existing and
-- ordinary response (interval_key IS NULL) is untouched. Notes to the guide never count.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_responses_interval
  ON lms_responses (enrolment_id, step_id, interval_key)
  WHERE interval_key IS NOT NULL AND kind <> 'note';
CREATE INDEX IF NOT EXISTS idx_lms_responses_interval
  ON lms_responses (run_id, step_id, interval_key)
  WHERE interval_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS workspace_cadences (
  host_type   VARCHAR(16)  NOT NULL CHECK (host_type IN ('lms_run', 'thread')),
  host_id     TEXT         NOT NULL,
  -- Which repeating piece on the host: for an ongoing session, its module id.
  scope_key   VARCHAR(64)  NOT NULL DEFAULT '',
  -- The repeating step (lms_steps.id) when the host is an lms_run; NULL for other hosts.
  step_id     TEXT         REFERENCES lms_steps(id) ON DELETE CASCADE,
  every_days  SMALLINT     NOT NULL CHECK (every_days BETWEEN 1 AND 31),
  start_date  DATE         NOT NULL,
  end_date    DATE,
  -- Entries close when the interval ends (the owner's default); false = a past interval stays open for late entries.
  closes      BOOLEAN      NOT NULL DEFAULT TRUE,
  -- Participants may read the others' entries before entering their own.
  read_first  BOOLEAN      NOT NULL DEFAULT FALSE,
  show_count  SMALLINT     NOT NULL DEFAULT 5 CHECK (show_count IN (5, 7)),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (host_type, host_id, scope_key),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS workspace_materials (
  host_type    VARCHAR(16)  NOT NULL CHECK (host_type IN ('lms_run', 'thread')),
  host_id      TEXT         NOT NULL,
  scope_key    VARCHAR(64)  NOT NULL DEFAULT '',
  -- '' = material for the whole piece; otherwise one interval ("YYYY-MM-DD").
  interval_key VARCHAR(10)  NOT NULL DEFAULT '',
  note         TEXT,
  -- [{ "id": "...", "name": "...", "url": "...", "access": "open" | "participants" }]
  items        JSONB        NOT NULL DEFAULT '[]'::jsonb,
  updated_by   UUID         REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (host_type, host_id, scope_key, interval_key)
);
