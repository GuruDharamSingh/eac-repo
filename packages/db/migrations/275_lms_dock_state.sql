-- 275: lms_dock_state: the dock's current step, departure and last tick, one row per person (2026-11-16).
--
-- DOCK_RAILS_PLAN L5/L6, DOCK_LOOP_SLICE1. Additive; nothing reads it until the dock code ships, and the
-- code tolerates the table being absent (42P01 is logged once, the dock falls back to the LMS outline).
--   course_slug, step_slug  the trail the person chose / is on (a convenience; the LMS outline is the truth)
--   run_id                  reserved for runbook runs (P3); no foreign key until that table exists
--   departed_from, ticket   set when "Take me there" leaves the page; NULL = not away. departed_from is a local path
--   departed_at             a departure older than 2 hours is ignored by the reader
--   done_*                  the last step the completion hook ticked on this trail, shown once as the Done card
-- Deleting the user deletes the row.

CREATE TABLE IF NOT EXISTS lms_dock_state (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  course_slug      varchar(120),
  step_slug        varchar(120),
  run_id           text,
  departed_from    text,
  departed_at      timestamptz,
  ticket           varchar(16),
  done_course_slug varchar(120),
  done_step_slug   varchar(120),
  done_at          timestamptz,
  done_seen_at     timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (departed_from IS NULL OR (departed_from ~ '^/' AND departed_from !~ '^//' AND departed_from !~ '\\' AND length(departed_from) <= 600)),
  CHECK ((departed_from IS NULL) = (ticket IS NULL))
);
