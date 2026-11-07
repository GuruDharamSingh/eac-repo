-- 246: action_events.subject_id — which thing a subject-scoped registry call acted on (2026-11-06).
--
-- The action registry gained entries that act on one existing post (scope
-- 'thread': thread-edit, thread-publish, thread-pin). performAction writes the
-- post's id here; org_id is the post's own org. NULL for person and org entries.
-- Additive; the table stays append-only (migration 245's trigger).

ALTER TABLE action_events ADD COLUMN IF NOT EXISTS subject_id varchar(64);

CREATE INDEX IF NOT EXISTS idx_action_events_subject ON action_events (subject_id, occurred_at)
  WHERE subject_id IS NOT NULL;
