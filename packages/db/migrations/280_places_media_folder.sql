-- 280: places.media_folder — the Nextcloud folder that holds a place's pictures (2026-11-20).
-- Set once when the place is created (EAC_Network/<org>/Places/<slug at creation>) and kept when the
-- slug changes, so tour_assets rows that point into the folder stay valid. NULL = no folder yet.
ALTER TABLE places ADD COLUMN IF NOT EXISTS media_folder text;
