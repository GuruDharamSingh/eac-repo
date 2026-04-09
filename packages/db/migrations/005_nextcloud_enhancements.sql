/**
 * Migration 005: Nextcloud Integration Enhancements
 *
 * Adds missing Nextcloud columns for full integration:
 * - Talk video chat tokens and recordings
 * - Calendar event IDs for sync
 * - Poll IDs for tracking
 * - Sync status flags
 */

-- Add Talk integration columns to meetings
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS nextcloud_talk_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS nextcloud_recording_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS nextcloud_calendar_event_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS nextcloud_calendar_synced BOOLEAN DEFAULT FALSE;

-- Add Poll integration columns to meetings (for availability polls)
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS nextcloud_poll_id INTEGER,
ADD COLUMN IF NOT EXISTS nextcloud_poll_synced BOOLEAN DEFAULT FALSE;

-- Add indexes for Nextcloud lookups
CREATE INDEX IF NOT EXISTS idx_meetings_nextcloud_talk ON meetings(nextcloud_talk_token) WHERE nextcloud_talk_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_nextcloud_calendar ON meetings(nextcloud_calendar_event_id) WHERE nextcloud_calendar_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_nextcloud_poll ON meetings(nextcloud_poll_id) WHERE nextcloud_poll_id IS NOT NULL;

-- Add sync tracking columns for posts
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS nextcloud_synced BOOLEAN DEFAULT FALSE;

-- Add sync tracking for media
ALTER TABLE media
ADD COLUMN IF NOT EXISTS nextcloud_synced BOOLEAN DEFAULT TRUE; -- TRUE by default since file already uploaded

-- Create a table to track Nextcloud webhook events
CREATE TABLE IF NOT EXISTS nextcloud_events (
  id VARCHAR(21) PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL, -- 'poll.created', 'calendar.updated', 'talk.recording_ready', etc.
  nextcloud_id VARCHAR(255) NOT NULL, -- ID in Nextcloud (poll ID, event ID, etc.)
  resource_type VARCHAR(50), -- 'meeting', 'post', etc.
  resource_id VARCHAR(21), -- Our database ID
  data JSONB, -- Full event payload
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for processing unprocessed events
CREATE INDEX IF NOT EXISTS idx_nextcloud_events_unprocessed ON nextcloud_events(processed, created_at) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_nextcloud_events_type ON nextcloud_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_nextcloud_events_resource ON nextcloud_events(resource_type, resource_id);

-- Comments for documentation
COMMENT ON COLUMN meetings.nextcloud_talk_token IS 'Nextcloud Talk room token for video chat';
COMMENT ON COLUMN meetings.nextcloud_recording_id IS 'Nextcloud file ID of Talk recording';
COMMENT ON COLUMN meetings.nextcloud_calendar_event_id IS 'Nextcloud Calendar event UID for sync';
COMMENT ON COLUMN meetings.nextcloud_calendar_synced IS 'Whether meeting is synced to Nextcloud Calendar';
COMMENT ON COLUMN meetings.nextcloud_poll_id IS 'Nextcloud Polls ID for availability polling';
COMMENT ON COLUMN meetings.nextcloud_poll_synced IS 'Whether poll is synced to Nextcloud';

COMMENT ON TABLE nextcloud_events IS 'Webhook events from Nextcloud for data synchronization';
