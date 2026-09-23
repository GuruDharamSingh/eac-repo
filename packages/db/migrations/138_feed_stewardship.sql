-- ============================================================================
-- 138: feed stewardship — one org governs another's forum, and a category can
-- say who may START topics in it.
--
-- Two gaps the Elkdonis hub tab ran into (2026-09-18):
--
-- 1. The `elkdonis` org is the collective's umbrella, but nobody holds more
--    than `member` on it. The people who actually run the collective are the
--    owners of `inner_group`. Copying their roles onto `elkdonis` would need
--    keeping two rosters in sync by hand, so instead an org can name a
--    STEWARD org: that org's owners and guides count as guides here, in the
--    forum (applied in services' getViewerRoles, the one place every host
--    builds a ForumViewer). It is NOT applied to getOrgRole, so a steward
--    cannot edit the stewarded org's settings, members or site.
--
-- 2. `org_feeds.min_role` gates READING. There was no write gate — any
--    signed-in user may start a topic in any feed they can read (the
--    2026-09-08 posting rule). An announcements category needs a readable-by-
--    everyone, postable-by-few shape: `post_role`. NULL keeps the old rule.
--    Replies are unaffected — people can still answer an announcement.
-- ============================================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS steward_org_id VARCHAR(50)
    REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_steward_not_self;
ALTER TABLE organizations
  ADD CONSTRAINT organizations_steward_not_self CHECK (steward_org_id IS NULL OR steward_org_id <> id);

ALTER TABLE org_feeds
  ADD COLUMN IF NOT EXISTS post_role VARCHAR(20);

ALTER TABLE org_feeds
  DROP CONSTRAINT IF EXISTS org_feeds_post_role_check;
ALTER TABLE org_feeds
  ADD CONSTRAINT org_feeds_post_role_check
    CHECK (post_role IS NULL OR post_role IN ('member', 'guide', 'owner'));

-- The inner group stewards the collective's umbrella org.
UPDATE organizations SET steward_org_id = 'inner_group' WHERE id = 'elkdonis';

-- The three categories the hub tab reads and links into.
INSERT INTO org_feeds (org_id, slug, name, tagline, description, sort_order, is_public, min_role, post_role)
VALUES
  ('elkdonis', 'announcements', 'Announcements',
   'News from the collective',
   'Notices from the people who steward Elkdonis Arts Collective. Anyone may reply; only stewards start a topic here.',
   1, TRUE, NULL, 'guide'),
  ('elkdonis', 'feedback', 'Feedback',
   'Tell us what works and what doesn''t',
   'Bugs, wishes, confusions and thanks about the network and its sites. One topic per thing, please — it keeps the index useful.',
   2, TRUE, NULL, NULL),
  ('elkdonis', 'cross-posts', 'Cross-post suggestions',
   'Point the network at something worth sharing',
   'Suggest a post, event or piece of work from any member site that the wider network should see. Stewards pick from here for the hub''s promotion space.',
   3, TRUE, NULL, NULL)
ON CONFLICT (org_id, slug) DO NOTHING;
