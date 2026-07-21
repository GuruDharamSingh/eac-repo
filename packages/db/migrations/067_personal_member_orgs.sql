-- ============================================================================
-- Migration 067: Personal orgs for the core members
-- ============================================================================
-- The early core group was parked in inner_group as a placeholder while the
-- larger multi-org structure was built. As the full launch approaches, each
-- core member gets their own org so workshop attendees join THAT org rather
-- than inner_group. /3004 (inner-gathering) remains an aggregated feed and
-- the NFP landing page; members keep their inner_group membership for now.
--
--   surrealistwriting — Dana McCool      (danamccoolart@gmail.com)
--   stonebalancing    — Jason Ford        (fnordj@gmail.com)
--   saw               — Stephan Wrede     (stephan@wrede.ca)
--   amrit_canada      — Guru Dharam Singh (gurudharamsingh@gmail.com)
--                       (existing org — ownership added, no new org)
--
-- The user account for gurudharamsingh@gmail.com is created out-of-band via
-- the Supabase auth admin API (no credentials in migration history). All
-- inserts here are idempotent and tolerate a missing user row: membership
-- rows are only created for users that exist at run time.
-- ============================================================================

-- New personal orgs (id == slug == future subdomain, per /api/org/create convention)
INSERT INTO organizations (id, name, slug, description) VALUES
  ('surrealistwriting', 'Surrealist Writing', 'surrealistwriting',
   'Surrealist writing workshops and publications by Dana McCool'),
  ('stonebalancing',    'Stone Balancing',    'stonebalancing',
   'Stone balancing practice and workshops by Jason Ford'),
  ('saw',               'SAW',                'saw',
   'Workshops and publications by Stephan Wrede')
ON CONFLICT (id) DO NOTHING;

-- Owner memberships (skipped silently if the user doesn't exist yet)
INSERT INTO user_organizations (user_id, org_id, role)
SELECT u.id, v.org_id, 'owner'
FROM (VALUES
  ('danamccoolart@gmail.com',     'surrealistwriting'),
  ('fnordj@gmail.com',            'stonebalancing'),
  ('stephan@wrede.ca',            'saw'),
  ('gurudharamsingh@gmail.com',   'amrit_canada')
) AS v(email, org_id)
JOIN users u ON u.email = v.email
ON CONFLICT (user_id, org_id) DO NOTHING;
