-- ============================================================================
-- Migration 113: the forum's `general` feed is not a site section
-- ============================================================================
-- 110 gave every org a `general` feed so every thread has a home on the
-- board. Org sites build their navigation from org_feeds WHERE is_public,
-- so a "General" link appeared in every site's header the moment 110 ran.
-- The feed exists for the forum, not the site: hide it from site nav. The
-- forum's read layer includes `general` regardless of is_public.
-- ============================================================================

BEGIN;

UPDATE org_feeds SET is_public = FALSE, updated_at = NOW()
WHERE slug = 'general' AND tagline = 'Everything that has no other home';

COMMIT;
