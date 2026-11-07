-- ============================================================================
-- 244: katie-the-potter — the owner row, now that the placeholder account exists.
--
-- Migration 243 ran before any `users` row carried the placeholder address,
-- so its membership insert matched nothing. The account was created through
-- GoTrue on 2026-11-06 (public.users via handle_new_user); this repeats the
-- same idempotent insert. When Katie's real address replaces the placeholder,
-- a later migration repeats it again with that address.
-- ============================================================================

BEGIN;

INSERT INTO user_organizations (user_id, org_id, role)
SELECT u.id, 'katie-the-potter', 'owner'
FROM users u
WHERE lower(u.email) = 'katie@katiethepotter.example'
ON CONFLICT (user_id, org_id) DO UPDATE SET role = 'owner';

COMMIT;
