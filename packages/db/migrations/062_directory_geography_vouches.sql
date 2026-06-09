-- ============================================================================
-- Migration 062: Directory geography + community vouches
-- ============================================================================
-- Two foundations for the OAD as a wiki/classifieds cornerstone:
--   1. Structured geography (city/region/country) so community hubs can pull
--      artist dossiers BY AREA (the arts-collective community portal is built
--      around "artists in your region"). `location` (061) stays as free-text
--      display; these are the grouping keys.
--   2. `directory_vouches` — a ledger of community verifications. Anyone with
--      an account can vouch once per profile; the count is social proof, and a
--      collective steward flips `directory_profiles.verified` for the badge.
-- ============================================================================

BEGIN;

ALTER TABLE directory_profiles
  ADD COLUMN IF NOT EXISTS city    TEXT,
  ADD COLUMN IF NOT EXISTS region  TEXT,   -- state / province / metro — hub grouping key
  ADD COLUMN IF NOT EXISTS country TEXT;

CREATE INDEX IF NOT EXISTS idx_directory_profiles_geo
  ON directory_profiles (country, region, status);

CREATE TABLE IF NOT EXISTS directory_vouches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES directory_profiles(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_directory_vouches_profile
  ON directory_vouches (profile_id);

COMMIT;
