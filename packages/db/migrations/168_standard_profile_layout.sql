-- ============================================================================
-- 168: the standard person page becomes the default layout (2026-09-26)
-- ============================================================================
-- ArtDirect's `standard` layout now renders the shared PersonPage in the
-- "frame" look taken from IFAC's artist page (person-page.css). The developer
-- chose it as the default for everyone (2026-09-26):
--
--   - new rows default to 'standard' (was 'dossier', migration 091);
--   - every person still on 'dossier' moves to 'standard'. No row records
--     whether 'dossier' was chosen or inherited, so all of them move. The
--     only person with dossier-only fields (oad_dossier) was the unclaimed
--     sample entry `jane-doe`; the fields stay stored.
--
-- A person can switch back from the owner sidebar on ArtDirect
-- (setProfileLayoutAction). Organisation rows were already 'standard'.
-- ============================================================================

ALTER TABLE users ALTER COLUMN profile_layout SET DEFAULT 'standard';

UPDATE users
   SET profile_layout = 'standard'
 WHERE entity_type = 'person' AND profile_layout = 'dossier';
