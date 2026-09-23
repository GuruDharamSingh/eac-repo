-- ============================================================================
-- 143: Sophia — a run's per-step conversations.
--
-- The community classroom gives each step of a cohort/circle run its own
-- forum thread, so the forum, the dictionary and the map come for free. The
-- thread is an ordinary `post` in the run's discussion feed (lms_runs.
-- discussion_feed, an org_feeds slug); this table only remembers which thread
-- belongs to which step of which run. The quiet (open) mode has none.
-- ============================================================================
CREATE TABLE IF NOT EXISTS lms_run_discussions (
  run_id      TEXT NOT NULL REFERENCES lms_runs(id)  ON DELETE CASCADE,
  step_id     TEXT NOT NULL REFERENCES lms_steps(id) ON DELETE CASCADE,
  thread_id   TEXT NOT NULL REFERENCES threads(id)   ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, step_id)
);
