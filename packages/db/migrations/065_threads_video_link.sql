-- Migration 065: Add video_link column to threads table
-- video_link stores a standalone video/meeting URL (Zoom, Meet, etc.) for any meeting kind.
-- Distinct from meeting_url (the join URL for online meetings) to preserve backwards compat.

ALTER TABLE threads ADD COLUMN IF NOT EXISTS video_link TEXT;
