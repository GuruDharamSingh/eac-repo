-- ============================================================================
-- 125: danamccool — Dana McCool's personal artist site (apps/danamccool, port 3018)
--
-- A dedicated org for her public site, same shape as `sunjay` / `guru-dharam`
-- (053_seed_base_orgs): a personal blog/portfolio org, separate from any
-- other org the same person owns. Dana already owns `surrealistwriting`
-- (067_personal_member_orgs — her workshop offering org); this is not a
-- replacement for that, it is her personal site's own org_id, matching the
-- app-per-org convention every other blog app follows.
--
-- Content model: this app uses @elkdonis/blog-client/-server (posts under
-- org_id='danamccool') plus user_galleries (124), which is owned by the
-- PERSON (users.id), not the org, so no gallery-specific rows belong here.
-- No org_feeds row: a solo artist site has no network feed to publish into.
--
-- Owner: danamccoolart@gmail.com, the same address migration 067 used for
-- her surrealistwriting ownership. The insert below is a no-op until her
-- `users` row exists (created via GoTrue signup / admin provisioning).
-- ============================================================================

BEGIN;

INSERT INTO organizations (id, name, slug, description, tier) VALUES
  ('danamccool', 'Dana McCool', 'danamccool',
   'Dana McCool — artist. Personal site.',
   'free')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_organizations (user_id, org_id, role)
SELECT u.id, 'danamccool', 'owner'
FROM users u
WHERE lower(u.email) = 'danamccoolart@gmail.com'
ON CONFLICT (user_id, org_id) DO NOTHING;

COMMIT;
