-- ============================================================================
-- Migration 086: users geocoding + profile_vouches (ArtDirect adoption)
-- ============================================================================
-- ArtDirect (org_id='oad') is moving off directory_profiles onto users +
-- org_profiles, same as IFAC (085). Two things directory_profiles carried
-- that users doesn't yet:
--
-- (a) postal_code/lat/lng (migration 063) — structured place data from a
--     places-autocomplete pick, for future proximity/radius search. Global
--     to the person, same as city/region/country (084), so it lands on
--     `users` rather than being re-siloed per org.
--
-- (b) directory_vouches — community verification ledger, FK'd to
--     directory_profiles(id). Replaced with profile_vouches, FK'd to
--     users(id): a vouch is "I vouch for this PERSON", and a person can now
--     be vouched for independent of which org's roster they're on.
--     directory_vouches had zero rows in every environment this was written
--     against, so this is a fresh table, not a migration of existing yea.
-- ============================================================================

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS lat         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng         DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_users_latlng ON users (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE TABLE IF NOT EXISTS profile_vouches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voucher_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subject_id, voucher_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_vouches_subject ON profile_vouches (subject_id);

COMMENT ON TABLE profile_vouches IS
  'Community verification ledger — anyone with an account can vouch once per person. Count is social proof; a steward flips users.verified for the badge. Successor to directory_vouches (FK''d to the now-legacy directory_profiles).';

COMMIT;
