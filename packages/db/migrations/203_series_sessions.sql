-- 203: series_sessions sidecar for lazily materialised series weeks, with backfill (2026-10-10)
--
-- Design: docs/open/SERIES_KIND_DESIGN_2026-10-10.md section 3 (step 2).
-- One row per materialised week of a meeting series, keyed by the week's
-- `series_session` thread. The series rule still produces empty future
-- slots; a slot becomes a row the first time anything is written to it.
--   number     stable week number; `/series/<slug>/<n>` resolves by it first
--   slot_at    the rule slot the week belongs to (NULL reserved for weeks
--              with no rule, e.g. workshops later)
--   starts_at  when the week actually meets; a move changes this and keeps
--              slot_at ("moved" = starts_at <> slot_at). meeting_occurrence_notes
--              and meeting_hosts stay keyed by (series thread, starts_at).
--   status     scheduled | cancelled
--   published_at  when an organiser published the week (was
--              threads.metadata.seriesSession.publishedAt on the week's thread)
--
-- Unique slot_at holds for cancelled rows too, so a cancelled week keeps its
-- slot and can be restored; unique starts_at ignores cancelled rows.

CREATE TABLE IF NOT EXISTS series_sessions (
  session_thread_id VARCHAR(21) PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
  series_id         VARCHAR(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  org_id            VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  number            INTEGER NOT NULL CHECK (number >= 1),
  slot_at           TIMESTAMPTZ,
  starts_at         TIMESTAMPTZ NOT NULL,
  status            VARCHAR(16) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS series_sessions_series_number_key
  ON series_sessions (series_id, number);

CREATE UNIQUE INDEX IF NOT EXISTS series_sessions_series_slot_key
  ON series_sessions (series_id, slot_at) WHERE slot_at IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS series_sessions_series_starts_key
  ON series_sessions (series_id, starts_at) WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_series_sessions_org_starts
  ON series_sessions (org_id, starts_at);

-- Backfill: every non-archived series_session thread linked from
-- meeting_occurrence_notes.topic_thread_id, in the same org as its series.
-- No week has been moved before this migration, so slot_at = starts_at =
-- the note's occurrence_at. The number and publishedAt come from the
-- thread's metadata.seriesSession; a malformed publishedAt reads as NULL.
INSERT INTO series_sessions (session_thread_id, series_id, org_id, number, slot_at, starts_at, status, published_at)
SELECT t.id,
       n.thread_id,
       t.org_id,
       (t.metadata->'seriesSession'->>'number')::int,
       n.occurrence_at,
       n.occurrence_at,
       'scheduled',
       CASE
         WHEN t.metadata->'seriesSession'->>'publishedAt' ~ '^\d{4}-\d{2}-\d{2}T'
           THEN (t.metadata->'seriesSession'->>'publishedAt')::timestamptz
       END
FROM meeting_occurrence_notes n
JOIN threads t ON t.id = n.topic_thread_id
JOIN threads s ON s.id = n.thread_id AND s.org_id = t.org_id
WHERE t.kind = 'series_session'
  AND t.status <> 'archived'
  AND t.metadata->'seriesSession'->>'number' ~ '^[0-9]+$'
  AND (t.metadata->'seriesSession'->>'number')::int >= 1
ON CONFLICT DO NOTHING;
