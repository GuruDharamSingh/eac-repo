-- 172_users_profile_section_order.sql
-- A person's own order of the sections on their ArtDirect page. 2026-09-27.
--
-- Section on/off already lives in users.profile_sections (jsonb key->bool);
-- the order on ArtDirect (org oad) was fixed to PERSON_SECTIONS. The
-- developer wants it changeable ("writing can go above or below galleries").
-- Keys not listed keep their default position after the listed ones
-- (resolvePersonSections, packages/services/src/person-page.ts). Org person
-- pages keep the org's order (organizations.person_page.order).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS profile_section_order text[];

COMMENT ON COLUMN public.users.profile_section_order IS
  'Order of the person''s ArtDirect page sections (PERSON_SECTIONS keys). '
  'NULL = the default order.';
