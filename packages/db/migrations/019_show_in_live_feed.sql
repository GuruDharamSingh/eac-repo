-- Migration: Add show_in_live_feed column to meetings table
-- This allows meetings to opt-in to appearing on the public /live video feed

ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS show_in_live_feed BOOLEAN DEFAULT false;

-- Add index for better query performance on live feed endpoint
CREATE INDEX IF NOT EXISTS idx_meetings_live_feed
ON meetings(org_id, show_in_live_feed, scheduled_at)
WHERE show_in_live_feed = true AND status = 'published';
