-- ============================================================================
-- Migration 091: let a person choose how their profile page is rendered
-- ============================================================================
-- ArtDirect renders every profile through the `dossier-classified` template —
-- the redacted-intelligence-file look. It is a strong piece of design and it
-- is not what every artist wants their portfolio to be. Meanwhile a
-- `portfolio` template (8 sections, 640 lines of CSS) sits on disk unused.
--
-- organizations.layout_mode ('default' | 'silex') is the same idea one level
-- up: an org picks between the standard React page and a published template.
-- This is that, for a person.
--
-- Deliberately NOT a CHECK-constrained enum, following migration 073's lesson
-- (threads.section's hardcoded CHECK became the org_feeds table so sections
-- could be data). Templates already live on disk as manifest folders — adding
-- one should be adding a folder, not shipping a migration. The value is
-- validated in the app against the template registry instead; the constraint
-- here only keeps the column shaped like a slug.
--
-- 'standard' is reserved to mean "the React page, no template". Everything
-- else names a template directory.
--
-- Default is 'dossier' rather than 'standard' so nothing changes appearance
-- for the 34 existing people until someone actively chooses otherwise.
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_layout VARCHAR(30) NOT NULL DEFAULT 'dossier';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_profile_layout_shape;
ALTER TABLE users
  ADD CONSTRAINT users_profile_layout_shape
  CHECK (profile_layout ~ '^[a-z][a-z0-9-]{1,28}$');

COMMENT ON COLUMN users.profile_layout IS
  '''standard'' = the React profile page. Any other value names a template directory (dossier, portfolio). Validated against the template registry in app code, not by a CHECK — see migration 073 for why.';
