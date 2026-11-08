-- 260 · What kind of org this is (Site Builder → Profile, the identity card).
-- 2026-11-08. docs/open/hub-cards-handoff/PLAN.md §6 E.
--
-- On the row the org identity already writes: an org identity is a users row
-- (organizations.profile_user_id, migration 099), so the directory, content
-- detail and Channel read one place. NOT org_capabilities: the spec says the
-- profile never switches hub cards on or off. One main kind plus any "also".

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS identity_kind text
    CHECK (identity_kind IN ('artist', 'collective', 'services', 'store', 'gatherings', 'writing')),
  ADD COLUMN IF NOT EXISTS identity_also_kinds text[] NOT NULL DEFAULT '{}'
    CHECK (identity_also_kinds <@ ARRAY['artist', 'collective', 'services', 'store', 'gatherings', 'writing']::text[]);
