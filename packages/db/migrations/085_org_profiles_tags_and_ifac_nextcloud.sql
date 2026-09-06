-- ============================================================================
-- Migration 085: org_profiles.tags (generic per-org labels)
-- ============================================================================
-- First consumer: IFAC, which needs to bucket its roster into "artist" vs
-- "dealer" for /artists and /dealers. That's org-specific categorization —
-- not every org has it, and the shape of it (dealer/artist here, maybe
-- board-member/volunteer elsewhere) shouldn't be baked into org_profiles'
-- DDL as separate boolean columns per future org. One text[] instead,
-- following the same "data not DDL" principle as org_feeds (073) and
-- threads.section: an org's own read layer filters on tags @> ARRAY[...],
-- the shared profiles service doesn't need to know what they mean.
-- ============================================================================

BEGIN;

ALTER TABLE org_profiles ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_org_profiles_tags ON org_profiles USING GIN (tags);

COMMENT ON COLUMN org_profiles.tags IS
  'Org-defined labels for this person on this org''s site (e.g. IFAC: artist/dealer). Not interpreted by shared code — each org''s own read layer defines what its tags mean.';

COMMIT;
