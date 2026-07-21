-- ============================================================================
-- Migration 069: Workshop/meeting reminder emails
-- ============================================================================
-- One ledger row per (thread, scheduled occurrence) send — the scheduler
-- claims a row before sending so overlapping ticks (or multiple app
-- instances) can't double-send. Reminder lead time is stored on the thread.
-- ============================================================================

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS reminder_minutes_before INTEGER DEFAULT 60;

CREATE TABLE IF NOT EXISTS thread_reminder_sends (
  thread_id     VARCHAR(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  occurrence_at TIMESTAMPTZ NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recipients    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (thread_id, occurrence_at)
);
