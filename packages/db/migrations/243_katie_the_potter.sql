-- ============================================================================
-- 243: katie-the-potter — Katie the Potter's own shop site (apps/katie-the-potter, port 3023)
--
-- A dedicated org for her public site, the same shape as `danamccool` (125):
-- a personal site org, separate from the marketplace org (`market`) where her
-- STORE and ARTWORKS live. Nothing of the store is seeded here: a store is
-- opened through applyForStore/approveStore and pieces through createArtwork,
-- which exercise the real guards (apps/katie-the-potter/scripts/seed-katie.md
-- has the exact command). No `users` row either — GoTrue creates it when she
-- signs up.
--
-- Owner: keyed by email below. PLACEHOLDER until her real address is known;
-- until then the second insert matches nothing and is a no-op. When the
-- address is known, a later migration repeats the same insert with it (do not
-- edit this file once applied). The app reads the same address from
-- NEXT_PUBLIC_KATIE_THE_POTTER_OWNER_EMAIL (src/config/site.ts).
-- ============================================================================

BEGIN;

INSERT INTO organizations (id, name, slug, description, tier) VALUES
  ('katie-the-potter', 'Katie the Potter', 'katie-the-potter',
   'Katie the Potter — ceramics, thrown and glazed by hand. Her own shop site; pieces are sold through Collect Art.',
   'free')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_organizations (user_id, org_id, role)
SELECT u.id, 'katie-the-potter', 'owner'
FROM users u
WHERE lower(u.email) = 'katie@katiethepotter.example'
ON CONFLICT (user_id, org_id) DO NOTHING;

COMMIT;
