-- 170_directory_listed_default_false.sql
-- New principals start unlisted on ArtDirect. 2026-09-27.
--
-- Migration 100 made users.directory_listed default TRUE, so every signup
-- (a viewer who may only have come to read a post or book a workshop) was
-- listed on ArtDirect. The developer's rule (2026-09-27): a person is listed
-- once they gain their space in the collective — oad membership and a storage
-- folder — which gainSpace() (packages/services/src/artist-space.ts) sets.
-- Existing rows are not changed here; that reconciliation is a separate,
-- confirmed data fix.

ALTER TABLE public.users
  ALTER COLUMN directory_listed SET DEFAULT false;
