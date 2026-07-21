-- ============================================================================
-- Migration 068: Workshop page media slots
-- ============================================================================
-- The detail page gets distinct media slots (owner-editable in place):
--   banner_image_url — wide banner behind the title (cover_image_url remains
--                      the card/feed thumbnail; banner falls back to it)
--   hero_media_url   — "main media" shown in the body (image or video)
--   hero_media_type  — discriminator for the hero slot
-- ============================================================================

ALTER TABLE workshop_pages
  ADD COLUMN IF NOT EXISTS banner_image_url TEXT,
  ADD COLUMN IF NOT EXISTS hero_media_url   TEXT,
  ADD COLUMN IF NOT EXISTS hero_media_type  VARCHAR(10)
    CHECK (hero_media_type IN ('image', 'video'));
