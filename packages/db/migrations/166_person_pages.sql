-- ============================================================================
-- 166: person pages — per-org section choices, org page settings (2026-09-26)
-- ============================================================================
-- Design: docs/open/PERSON_PAGES_BRIEF_2026-09-26.md.
--
-- A person's page on an org site shows the sections the org offers AND the
-- person allows there. The person's network-wide default stays in
-- `users.profile_sections` (migration 105); this adds the per-org override
-- and the org's own settings.
--
--   org_profiles.sections      { "<section>": true|false } for this org only.
--                              A missing key inherits users.profile_sections.
--   organizations.person_page  { "sections": [...offered keys], "order": [...] }.
--                              Empty object = the default set, default order.
--                              Section keys are application vocabulary
--                              (packages/services/src/person-page.ts), not a
--                              CHECK constraint.
--
-- `oad` (ArtDirect) is the home org for personal content and has no members.
-- Its one feed, `general`, had NULL min_role/post_role, which let any signed-in
-- person create a topic there through createTopic. Personal posts are written
-- through the person-page service, gated on authorship, so the feed is closed
-- to posting (owner only; oad has no owners).
-- ============================================================================

ALTER TABLE org_profiles
  ADD COLUMN IF NOT EXISTS sections JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS person_page JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE org_feeds
   SET post_role = 'owner'
 WHERE org_id = 'oad' AND slug = 'general' AND post_role IS NULL;
