-- ============================================================================
-- Migration 032: Artist Profiles (arts-collective onboarding)
-- ============================================================================
-- Adds the artist_profiles table: one row per user, captured from the
-- arts-collective wizard. Each row is tied to exactly one organization (the
-- user's "corner"). This is the structured form of everything an artist tells
-- us during onboarding so the team can turn it into a real public page.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS artist_profiles (
  user_id              UUID         PRIMARY KEY REFERENCES users(id)         ON DELETE CASCADE,
  org_id               VARCHAR(50)  NOT NULL    REFERENCES organizations(id) ON DELETE CASCADE,

  display_name         VARCHAR(120) NOT NULL,
  pronouns             VARCHAR(40),
  city                 VARCHAR(120) NOT NULL,
  bio                  TEXT         NOT NULL,
  photo_url            TEXT,

  disciplines          TEXT[]       NOT NULL DEFAULT '{}',
  disciplines_other    TEXT,
  years_active         INTEGER      NOT NULL DEFAULT 0,
  experience_level     VARCHAR(20)  NOT NULL CHECK (experience_level IN ('emerging', 'established')),

  audience_description TEXT         NOT NULL,
  audience_value       TEXT         NOT NULL,

  goals_seeking        TEXT         NOT NULL,
  goals_offering       TEXT         NOT NULL,

  world_hobbies        TEXT,
  world_values         TEXT,
  world_inspirations   TEXT,
  aesthetic_notes      TEXT,

  biggest_need         TEXT         NOT NULL,

  features_requested   TEXT[]       NOT NULL DEFAULT '{}',

  template_preference  VARCHAR(20)  NOT NULL CHECK (template_preference IN ('article', 'event', 'radio', 'business')),
  palette_preference   VARCHAR(80),

  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_profiles_org ON artist_profiles(org_id);

CREATE OR REPLACE FUNCTION artist_profiles_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_artist_profiles_updated_at ON artist_profiles;
CREATE TRIGGER trg_artist_profiles_updated_at
  BEFORE UPDATE ON artist_profiles
  FOR EACH ROW EXECUTE FUNCTION artist_profiles_touch_updated_at();

COMMIT;
