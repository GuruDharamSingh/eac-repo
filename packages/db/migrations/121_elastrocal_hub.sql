-- ============================================================================
-- 121: Elastrocal — hub content: the services feed and the first guide profile
--
-- Mirrors what 073/078 did for amrit_canada and hidden-enneagram:
--   (a) an org_feeds row 'services' — upsertServiceOffering files every
--       offering under threads.section='services', and 073's invariant is that
--       a section must name a real feed;
--   (b) an org_profiles row for the org's guide, so /people has someone on it.
--       Identity (name, bio, slug) lives on `users` and is not touched here.
--
-- Both statements are no-ops if the rows already exist, and the profile seed
-- is skipped if the account doesn't (same guard as 080).
-- ============================================================================

BEGIN;

INSERT INTO org_feeds (org_id, slug, name, tagline, description, sort_order, is_public)
VALUES (
  'elastrocal', 'services', 'Readings & Sessions',
  'Natal chart readings and consultations, booked directly.',
  'Services offered by the guides of Elastrocal.',
  1, true
)
ON CONFLICT (org_id, slug) DO NOTHING;

INSERT INTO org_profiles (org_id, user_id, role_title, sort_order, is_public, tags)
SELECT 'elastrocal', u.id, 'Astrology', 1, true, '{}'
FROM users u
WHERE lower(u.email) = 'gurudharamsingh@gmail.com'
ON CONFLICT (org_id, user_id) DO UPDATE SET is_public = true;

COMMIT;
