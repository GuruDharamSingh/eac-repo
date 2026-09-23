-- ============================================================================
-- 155: "Promise?" — a soft commitment attached to a "no, next time" answer.
--
-- User's call (2026-09-20): the "no, next time" flavour on a standing
-- meeting's RSVP gets an inline checkbox, tracked as part of the regular
-- meeting-attendance data rather than as a one-off flag somewhere else.
--
-- One boolean beside the existing `flavour` column (migration 130). It only
-- ever means something alongside `flavour = 'next_time'`; the write path
-- (setMeetingAttendance) clears it for every other answer, so a stale TRUE
-- can never survive under a different flavour.
-- ============================================================================

ALTER TABLE thread_rsvps
  ADD COLUMN IF NOT EXISTS promise_next BOOLEAN NOT NULL DEFAULT FALSE;
