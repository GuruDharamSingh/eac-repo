-- ============================================================================
-- Migration 044: Member signup defaults
-- ============================================================================
-- Allows multiple users to share the same org_id in artist_profiles (e.g.
-- many members all in 'elkdonis'). Previously a UNIQUE index enforced
-- one profile per org, which made sense when profiles were org-level.
-- Now every member gets an auto-created stub profile tied to their user_id,
-- all under the 'elkdonis' directory org.
--
-- Also adds is_stub flag to distinguish auto-created incomplete profiles
-- from ones filled in through the wizard.
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS idx_artist_profiles_org;
CREATE INDEX IF NOT EXISTS idx_artist_profiles_org ON artist_profiles(org_id);

ALTER TABLE artist_profiles
  ADD COLUMN IF NOT EXISTS is_stub BOOLEAN NOT NULL DEFAULT true;

COMMIT;
