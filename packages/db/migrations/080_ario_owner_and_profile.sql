-- ============================================================================
-- Migration 080: Ario as owner of hidden-enneagram, with a published profile
-- ============================================================================
-- aeon.g963@gmail.com — "aeon" in the users table, Ario in the world — runs
-- The Hidden Enneagram. He held only `member` in elkdonis and inner_group, so
-- he could not edit his own site: /manage requires owner or guide in
-- user_organizations for that org (packages/services/src/org-membership.ts).
-- This grants that.
--
-- It also promotes his signup stub into a published guide profile so /about
-- has a real person behind it. 073's rule still holds — a teacher page hangs
-- off a real account, and this is that account, so the page is legitimate
-- rather than a fabricated persona.
--
-- Note artist_profiles is keyed on user_id alone (the UNIQUE(org_id) index was
-- dropped in 044), so this moves his single profile row to hidden-enneagram
-- rather than adding a second one. He is a member of elkdonis, not a published
-- guide of it, so nothing is lost.
--
-- Both blocks are skipped silently where the user row doesn't exist, so this
-- migration is safe in a fresh or partial environment.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Ownership
-- ---------------------------------------------------------------------------

INSERT INTO user_organizations (user_id, org_id, role)
SELECT u.id, 'hidden-enneagram', 'owner'
FROM users u
WHERE u.email = 'aeon.g963@gmail.com'
  AND EXISTS (SELECT 1 FROM organizations WHERE id = 'hidden-enneagram')
ON CONFLICT (user_id, org_id) DO UPDATE SET role = 'owner';

-- ---------------------------------------------------------------------------
-- Published guide profile
-- ---------------------------------------------------------------------------

INSERT INTO artist_profiles (
  user_id, org_id, display_name, slug, role_title, bio, city,
  is_stub, is_public, sort_order
)
SELECT
  u.id, 'hidden-enneagram', 'Ario', 'ario',
  'Musician · Educator · Workshop facilitator',
  '<p>Ario is a music educator and workshop facilitator working between rhythm and self-observation. He runs drum circle and rhythm attunement programs through Sangre House, and teaches the enneagram as a map of attention rather than a personality quiz.</p><p>The work here treats the nine types as habits of attention — where it goes by default, what it avoids, and what becomes available when the habit loosens. Sessions are one-on-one or in small groups.</p>',
  'Los Angeles, USA',
  FALSE, TRUE, 1
FROM users u
WHERE u.email = 'aeon.g963@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  org_id       = 'hidden-enneagram',
  display_name = 'Ario',
  slug         = 'ario',
  role_title   = EXCLUDED.role_title,
  -- Don't clobber a bio he has since written himself.
  bio          = COALESCE(NULLIF(artist_profiles.bio, ''), EXCLUDED.bio),
  city         = COALESCE(NULLIF(artist_profiles.city, ''), EXCLUDED.city),
  is_stub      = FALSE,
  is_public    = TRUE,
  sort_order   = 1;

COMMIT;
