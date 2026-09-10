-- ============================================================================
-- Migration 109: the collective's board, as published profiles
-- ============================================================================
-- The old landing page hard-coded six board members in a React component
-- (BoardRow.tsx), with titles and photos that could only change by editing
-- code. The new innergathering site draws its board from `org_profiles` for
-- inner_group — the same rows ArtDirect edits — so a member updates their own
-- page and the board follows.
--
-- This seeds a public org_profile for each listed member, carrying the title
-- and photo the component showed, so nothing disappears on the switch.
-- ON CONFLICT DO NOTHING: a profile someone has already edited is theirs.
-- ============================================================================

INSERT INTO org_profiles (org_id, user_id, role_title, photo_override, sort_order, is_public)
SELECT 'inner_group', u.id, seed.role_title, seed.photo, seed.sort_order, true
FROM (VALUES
  ('rev-dr-sunjye-fnord-p-p-p-i-ulc-ac', 'Founder · Director of Operations',                '/fnordbalance-1.jpg',           1),
  ('steph',                              'Director of I.T. & Security · Technical Infrastructure', '/steph-1.jpg',          2),
  ('danamccool',                         'Co-Founder · Artist / Writer in Residence',        '/danamccool.jpg',              3),
  ('jg',                                 'Projects Manager · Director of Web Development',   '/GD-Full-for-Lotus-edited.jpg', 4),
  ('ario',                               'Executive Producer · Music & Video Director',      '/IMG-20250719-WA0001-1.jpg',   5),
  ('sarahchodos452',                     'Director of Public Relations · Community Outreach', NULL,                          6)
) AS seed(slug, role_title, photo, sort_order)
JOIN users u ON u.slug = seed.slug
ON CONFLICT (org_id, user_id) DO UPDATE
  SET role_title = COALESCE(org_profiles.role_title, EXCLUDED.role_title),
      photo_override = COALESCE(org_profiles.photo_override, EXCLUDED.photo_override),
      sort_order = CASE WHEN org_profiles.sort_order = 0 THEN EXCLUDED.sort_order ELSE org_profiles.sort_order END,
      is_public = true;
