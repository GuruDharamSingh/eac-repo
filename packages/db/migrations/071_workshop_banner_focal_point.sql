-- ============================================================================
-- Migration 071: Banner image vertical focal point
-- ============================================================================
-- The banner image is cropped to a fixed-height strip (300px, full width) at
-- the top of the workshop page. banner_focal_y lets the author choose which
-- part of the image stays visible in that crop — 0 = top of the image,
-- 50 = center (default), 100 = bottom. Rendered as CSS
-- `object-position: center {banner_focal_y}%`.
-- ============================================================================

ALTER TABLE workshop_pages
  ADD COLUMN IF NOT EXISTS banner_focal_y SMALLINT NOT NULL DEFAULT 50
    CHECK (banner_focal_y BETWEEN 0 AND 100);
