-- ============================================================================
-- Migration 087: users.headline
-- ============================================================================
-- ArtDirect (086) needs a short "what this person does" line for their
-- global profile page — occupation/role, distinct from the org-scoped
-- role_title on org_profiles (which can legitimately differ per org, e.g.
-- "Teacher" at amrit_canada vs. nothing elsewhere). A person's ArtDirect
-- page is their own, not any one org's, so it needs its own line. Global
-- fallback: an org page with no role_title override can show this instead.
-- ============================================================================

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS headline VARCHAR(160);

COMMENT ON COLUMN users.headline IS
  'Short occupation/role line for the person''s own profile page (ArtDirect). Distinct from org_profiles.role_title, which an org can override for its own site.';

COMMIT;
