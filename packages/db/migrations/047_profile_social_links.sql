-- Migration 047: social_links on artist_profiles
-- Adds a flexible JSONB column for the simplified profile page link list.
-- Each entry: { label: string, url: string }

BEGIN;

ALTER TABLE artist_profiles
  ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
