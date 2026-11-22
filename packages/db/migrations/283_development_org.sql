-- ============================================================================
-- 283: development — the network workbench's own organisation (apps/development,
--      arts-collective.com/development, network admins only). Justin, 2026-11-20:
--      "give apps/development its own org on the platform ... that way blocks
--      might be tested with field entries and publishing".
--
-- The same shape as `katie-the-potter` (243) and `danamccool` (125): one
-- organisations row, nothing seeded. Its pages are `site_config` rows keyed
-- `puck:<slug>` under this org like any site's, and its drafts `puck-draft:<slug>`
-- (packages/page-builder/src/drafts.ts). `subdomain_confirmed` stays false (the
-- default): this org has no public address and is not a site people visit.
--
-- Owners are NOT written here. The repository is public and an owner is a
-- person's email address: the two owners were added by hand on the day this
-- was applied (user_organizations, role 'owner'). To add one later:
--   INSERT INTO user_organizations (user_id, org_id, role)
--   SELECT id, 'development', 'owner' FROM users WHERE lower(email) = lower('<address>')
--   ON CONFLICT (user_id, org_id) DO UPDATE SET role = 'owner';
-- ============================================================================

INSERT INTO organizations (id, name, slug, description, tier) VALUES
  ('development', 'Development', 'development',
   'The network workbench: a private organisation for trying blocks, fields, drafts and publishing. Nothing here is public.',
   'free')
ON CONFLICT (id) DO NOTHING;
