-- Migration 013: Add min_attendees and recurrence_until columns to meetings table
-- These columns support notifying the guide when a minimum attendance threshold is reached,
-- and setting an end date for recurring meetings.

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS min_attendees integer,
  ADD COLUMN IF NOT EXISTS notify_on_min_attendees boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_attendees_notified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_until timestamp with time zone;
