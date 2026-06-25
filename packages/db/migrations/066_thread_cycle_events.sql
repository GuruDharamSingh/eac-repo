-- Migration 066: Cycle event log for recurring meetings.
-- Guides confirm or cancel each occurrence; the latest event within the
-- current cycle determines the meeting's status badge, and the full log
-- powers per-day analytics (how many confirms, when it was cancelled, etc).

CREATE TABLE IF NOT EXISTS thread_cycle_events (
  id         VARCHAR(21)  PRIMARY KEY,
  thread_id  VARCHAR(21)  NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id    UUID         NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  action     VARCHAR(20)  NOT NULL CHECK (action IN ('confirmed', 'cancelled')),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thread_cycle_events_thread
  ON thread_cycle_events(thread_id, created_at DESC);
