-- ============================================================================
-- Migration 037: Workshop CMS extras
-- ============================================================================
-- Adds optional pricing and a structured sessions array to threads, so a
-- workshop thread can advertise multiple sessions and an optional price tier
-- without needing a separate sessions table yet.
--
-- sessions JSONB shape (array):
--   [
--     {
--       "id": "abc123",
--       "title": "Session 1 — Foundations",
--       "scheduled_at": "2026-05-12T18:00:00Z",
--       "duration_minutes": 90,
--       "location": "Online",
--       "meeting_url": null
--     }
--   ]
-- ============================================================================

BEGIN;

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS price            NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS currency         VARCHAR(3)  DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS sessions         JSONB       DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS nextcloud_doc_url TEXT;

COMMENT ON COLUMN threads.price IS 'Optional price for kind=workshop/event. Null = free or not advertised.';
COMMENT ON COLUMN threads.sessions IS 'Optional array of sessions for kind=workshop. Each item: {id,title,scheduled_at,duration_minutes,location,meeting_url}';
COMMENT ON COLUMN threads.nextcloud_doc_url IS 'Optional link to a Nextcloud collaborative document attached to this thread.';

COMMIT;
