-- ============================================================================
-- Migration 063: Directory geocoding (structured place data)
-- ============================================================================
-- Stores the structured result of a places-autocomplete pick (Photon/OSM):
-- postal code + lat/lng. Combined with city/region/country (062), this gives
-- canonical, map-ready geography so hubs can do radius/proximity later and
-- contributors converge on the same canonical place instead of free-typing.
-- ============================================================================

BEGIN;

ALTER TABLE directory_profiles
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS lat         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng         DOUBLE PRECISION;

-- Lightweight geo index for future proximity/bbox queries.
CREATE INDEX IF NOT EXISTS idx_directory_profiles_latlng
  ON directory_profiles (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

COMMIT;
