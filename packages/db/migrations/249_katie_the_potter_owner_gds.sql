-- ============================================================================
-- 249: katie-the-potter — Guru Dharam Singh (gurudharamsingh@gmail.com) as an
-- owner of the site, at the developer's request on 2026-11-06.
--
-- Site role only (user_organizations). The marketplace store and its pieces
-- stay with the store owner; store actions are gated by store membership.
-- Fails loudly if no account carries the address, instead of matching nothing.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = 'gurudharamsingh@gmail.com') THEN
    RAISE EXCEPTION '249: no users row for gurudharamsingh@gmail.com';
  END IF;
END $$;

INSERT INTO user_organizations (user_id, org_id, role)
SELECT u.id, 'katie-the-potter', 'owner'
FROM users u
WHERE lower(u.email) = 'gurudharamsingh@gmail.com'
ON CONFLICT (user_id, org_id) DO UPDATE SET role = 'owner';

COMMIT;
