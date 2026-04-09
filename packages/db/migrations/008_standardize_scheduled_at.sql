/**
 * Migration 008: Standardize on scheduled_at Field
 * Date: 2025-11-04
 *
 * Removes start_time and end_time columns from meetings table.
 * Uses only scheduled_at and duration_minutes for meeting scheduling.
 * This fixes confusion between startTime/scheduledAt causing integration issues.
 */

-- First, ensure any data in start_time is copied to scheduled_at
UPDATE meetings
SET scheduled_at = start_time
WHERE scheduled_at IS NULL AND start_time IS NOT NULL;

-- Drop the start_time and end_time columns
ALTER TABLE meetings
DROP COLUMN IF EXISTS start_time CASCADE;

ALTER TABLE meetings
DROP COLUMN IF EXISTS end_time CASCADE;

-- Ensure scheduled_at index exists and is optimal
DROP INDEX IF EXISTS idx_meetings_scheduled;
CREATE INDEX idx_meetings_scheduled
ON meetings(scheduled_at DESC)
WHERE scheduled_at IS NOT NULL AND status = 'published';

-- Add index for upcoming meetings (commonly used query)
CREATE INDEX IF NOT EXISTS idx_meetings_upcoming
ON meetings(scheduled_at ASC)
WHERE scheduled_at > NOW() AND status = 'published';

-- Comments for documentation
COMMENT ON COLUMN meetings.scheduled_at IS 'Primary scheduling field - date and time when meeting starts';
COMMENT ON COLUMN meetings.duration_minutes IS 'Meeting duration in minutes. End time = scheduled_at + duration_minutes';
