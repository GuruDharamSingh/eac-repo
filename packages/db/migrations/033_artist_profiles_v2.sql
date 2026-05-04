-- ============================================================================
-- Migration 033: Artist Profiles v2 (wizard refinement)
-- ============================================================================
-- Reworks artist_profiles to match the revised onboarding wizard:
--   - Remove years_active (not tracked)
--   - Rename experience_level 'emerging' -> 'starting_fresh'
--   - Your World -> Your View: drop world_hobbies/values/inspirations;
--     keep aesthetic_notes; add personal_philosophy + aesthetic_keywords[]
--   - biggest_need TEXT -> needs TEXT[] (multi-select, optional empty)
--   - Step 3 structured audience: portfolio_url, audience_types[], client_base[]
--   - Step 4: goals_options[] + two mutual_aid booleans
--   - Step 7: features_other text
--   - Add organizations.subdomain_confirmed (defaults true for now;
--     an /admin/users gate will later require explicit confirmation)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- organizations: subdomain confirmation flag
-- ---------------------------------------------------------------------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS subdomain_confirmed BOOLEAN NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- artist_profiles: drop fields
-- ---------------------------------------------------------------------------
ALTER TABLE artist_profiles
  DROP COLUMN IF EXISTS years_active,
  DROP COLUMN IF EXISTS world_hobbies,
  DROP COLUMN IF EXISTS world_values,
  DROP COLUMN IF EXISTS world_inspirations;

-- Make formerly-required text columns optional so an empty profile row
-- can exist from signup time and be filled incrementally by the wizard.
ALTER TABLE artist_profiles
  ALTER COLUMN display_name         DROP NOT NULL,
  ALTER COLUMN city                 DROP NOT NULL,
  ALTER COLUMN bio                  DROP NOT NULL,
  ALTER COLUMN audience_description DROP NOT NULL,
  ALTER COLUMN audience_value       DROP NOT NULL,
  ALTER COLUMN goals_seeking        DROP NOT NULL,
  ALTER COLUMN goals_offering       DROP NOT NULL,
  ALTER COLUMN template_preference  DROP NOT NULL,
  ALTER COLUMN experience_level     DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- experience_level: rename 'emerging' -> 'starting_fresh'
-- Drop the constraint BEFORE backfilling, then re-add with new allowed values.
-- ---------------------------------------------------------------------------
ALTER TABLE artist_profiles
  DROP CONSTRAINT IF EXISTS artist_profiles_experience_level_check;

UPDATE artist_profiles SET experience_level = 'starting_fresh' WHERE experience_level = 'emerging';

ALTER TABLE artist_profiles
  ADD CONSTRAINT artist_profiles_experience_level_check
      CHECK (experience_level IS NULL OR experience_level IN ('starting_fresh', 'established'));

-- ---------------------------------------------------------------------------
-- biggest_need TEXT -> needs TEXT[] (migrate existing rows)
-- ---------------------------------------------------------------------------
ALTER TABLE artist_profiles
  ADD COLUMN IF NOT EXISTS needs TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'artist_profiles'
      AND column_name = 'biggest_need'
  ) THEN
    UPDATE artist_profiles
       SET needs = CASE
         WHEN biggest_need IS NOT NULL AND btrim(biggest_need) <> ''
           THEN ARRAY[biggest_need]
         ELSE '{}'::TEXT[]
       END
     WHERE needs = '{}'::TEXT[];
  END IF;
END $$;

ALTER TABLE artist_profiles DROP COLUMN IF EXISTS biggest_need;

-- ---------------------------------------------------------------------------
-- Step 5 (Your View): keep aesthetic_notes, add philosophy + keywords
-- ---------------------------------------------------------------------------
ALTER TABLE artist_profiles
  ADD COLUMN IF NOT EXISTS personal_philosophy TEXT,
  ADD COLUMN IF NOT EXISTS aesthetic_keywords  TEXT[] NOT NULL DEFAULT '{}';

-- ---------------------------------------------------------------------------
-- Step 3 (Audience): structured fields
-- ---------------------------------------------------------------------------
ALTER TABLE artist_profiles
  ADD COLUMN IF NOT EXISTS portfolio_url   TEXT,
  ADD COLUMN IF NOT EXISTS audience_types  TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS client_base     TEXT[] NOT NULL DEFAULT '{}';

-- ---------------------------------------------------------------------------
-- Step 4 (Goals + Mutual Aid)
-- ---------------------------------------------------------------------------
ALTER TABLE artist_profiles
  ADD COLUMN IF NOT EXISTS goals_options         TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mutual_aid_media      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mutual_aid_authoring  BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Step 7 (Features): free-text custom request
-- ---------------------------------------------------------------------------
ALTER TABLE artist_profiles
  ADD COLUMN IF NOT EXISTS features_other TEXT;

-- ---------------------------------------------------------------------------
-- template_preference: allow NULL now that the whole profile starts empty
-- ---------------------------------------------------------------------------
ALTER TABLE artist_profiles
  DROP CONSTRAINT IF EXISTS artist_profiles_template_preference_check;
ALTER TABLE artist_profiles
  ADD CONSTRAINT artist_profiles_template_preference_check
      CHECK (template_preference IS NULL OR template_preference IN ('article', 'event', 'radio', 'business'));

COMMIT;
