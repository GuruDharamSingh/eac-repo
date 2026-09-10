-- ============================================================================
-- Migration 108: InnerGathering's site sections
-- ============================================================================
-- The new innergathering app (the non-Mantine replacement for inner-gathering)
-- is built on the org_feeds pattern amrit-canada established in migration 073:
-- a site's sections are rows, and a thread belongs to a section through
-- `threads.section = org_feeds.slug`. inner_group had no feeds and every one
-- of its threads had a NULL section, so the new site's Blog and Offerings
-- pages would have been empty and none of its threads would have had a page.
--
-- Two feeds — the two pages the site has — and the published threads filed
-- into them by kind. Archived rows are left alone; they are not on any page.
-- ============================================================================

INSERT INTO org_feeds (org_id, slug, name, tagline, description, accent, sort_order, is_public)
VALUES
  (
    'inner_group', 'offerings', 'Offerings',
    'Meetings, workshops and gatherings',
    'What the collective is holding: standing meetings, workshops, readings and the occasional one-off. Most take RSVPs; some have a Talk room you can join without an account.',
    '#b79a55', 1, true
  ),
  (
    'inner_group', 'blog', 'Blog',
    'Writing from the collective',
    'Essays, notes and announcements from members of the Elkdonis Arts Collective.',
    '#d6c38e', 2, true
  )
ON CONFLICT (org_id, slug) DO NOTHING;

UPDATE threads
SET section = CASE WHEN kind = 'post' THEN 'blog' ELSE 'offerings' END
WHERE org_id = 'inner_group'
  AND section IS NULL
  AND status = 'published';
