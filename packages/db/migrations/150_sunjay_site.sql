-- ============================================================================
-- 150: stand up the `sunjay` org as a real site.
--
-- `apps/sunjay` replaces `apps/blog-sunjay` (a Mantine-era blog on the same
-- org). The org row has existed since the 2026-07-15 personal-org split but
-- was entirely empty: no members, no threads, and a single private `general`
-- feed created by the forum's default. A site built on the org_feeds pattern
-- (migration 073) needs sections to render, so this seeds the structure —
-- and only the structure. NO threads are created here: the landing page's
-- bands render their own empty states until their subject publishes, and
-- seeded example content would have to be found and deleted later.
--
-- Three feeds, matching the three content bands the landing page has:
--   gatherings  the next meeting / calendar band
--   writing     the blog shelf
--   materials   suggested reading and practice materials
--
-- `general` is left exactly as it is — private, sort 999, the forum's
-- catch-all. It is not a page.
-- ============================================================================

-- ── membership ──────────────────────────────────────────────────────────────
-- The site is about Rev Dr suNjye Fnord (fnordj@gmail.com). He owned
-- `stonebalancing` from the personal-org split but had no row on `sunjay` at
-- all, so nothing on this site would have been editable by its own subject.
--
-- Looked up by EMAIL, not by display name: the display name is
-- "Rev Dr suNjye Fnord P.P. P.I. ulc. AC." and no query should depend on it.
-- The INSERT is a no-op if the account is absent, so this migration stays
-- safe on a database that has not got him.
INSERT INTO user_organizations (user_id, org_id, role)
SELECT id, 'sunjay', 'owner' FROM users WHERE email = 'fnordj@gmail.com'
ON CONFLICT (user_id, org_id) DO UPDATE SET role = 'owner';

-- ── the site's sections ─────────────────────────────────────────────────────
INSERT INTO org_feeds (org_id, slug, name, tagline, description, accent, sort_order, is_public)
VALUES
  (
    'sunjay', 'gatherings', 'Gatherings',
    'Sittings, classes and one-off meetings',
    'Standing practice sessions and the occasional one-off. Most take RSVPs.',
    '#7c6a46', 1, true
  ),
  (
    'sunjay', 'writing', 'Writing',
    'Notes, teachings and essays',
    'Written pieces — teachings, practice notes, and whatever else is worth setting down.',
    '#a8763e', 2, true
  ),
  (
    'sunjay', 'materials', 'Materials',
    'Suggested reading and practice materials',
    'Texts, recordings and exercises offered alongside the gatherings.',
    '#5f6b5a', 3, true
  )
ON CONFLICT (org_id, slug) DO NOTHING;

-- ── landing copy ────────────────────────────────────────────────────────────
-- Placeholder wording, deliberately plain and free of any claim about venue,
-- lineage or affiliation — those belong to the owner to write, through
-- /manage/pages, not to a migration to assert on his behalf.
INSERT INTO org_site_sections (org_id, section_key, content)
VALUES
  ('sunjay', 'hero', jsonb_build_object(
    'title', 'Sunjay''s Teaching Circle',
    'subtitle', 'Rock balancing, qi gong, and conscious creativity',
    'body', 'A place for the practices, the gatherings that carry them, and the writing that comes out of both.',
    'cta_label', 'See what''s on',
    'cta_href', '/gatherings'
  )),
  ('sunjay', 'about', jsonb_build_object(
    'title', 'About',
    'body', 'Replace this from Manage → Pages.'
  )),
  ('sunjay', 'materials', jsonb_build_object(
    'title', 'Suggested materials',
    'body', 'Things worth sitting with between gatherings.'
  )),
  ('sunjay', 'footer', jsonb_build_object(
    'body', 'Sunjay''s Teaching Circle',
    'note', 'Part of the Elkdonis Arts Collective'
  ))
ON CONFLICT (org_id, section_key) DO NOTHING;

-- ── image spaces ────────────────────────────────────────────────────────────
-- Same `site_config` key the collective's landing uses, so the same Manage
-- screens write it. Empty slots: the page falls back rather than rendering a
-- broken image, and the owner fills them from his own media.
INSERT INTO site_config (org_id, key, value)
VALUES ('sunjay', 'image_spaces', jsonb_build_object(
  'hero', jsonb_build_object('path', '', 'alt', ''),
  'gallery', jsonb_build_object('images', '[]'::jsonb)
))
ON CONFLICT (org_id, key) DO NOTHING;

-- ── the bio card ────────────────────────────────────────────────────────────
-- Org-scoped, via org_profiles.bio_override, NOT users.bio: the network bio
-- is his to write once and have follow him everywhere, and a migration that
-- filled it would be putting words in his mouth across every EAC site. The
-- override is this site's placeholder and nothing else reads it.
--
-- Wording carried over from apps/blog-sunjay's config, which was his own
-- self-description on his own site.
--
-- This MUST be DO UPDATE, not DO NOTHING. The membership INSERT above fires
-- `trg_user_org_show_members`, which has already created this exact row
-- (org_id, user_id, is_public) with no title and no bio — so DO NOTHING would
-- match that trigger-made row and quietly leave the bio card blank. COALESCE
-- keeps the update one-way: it fills empty fields and never overwrites
-- anything he has since written.
INSERT INTO org_profiles (org_id, user_id, role_title, bio_override, sort_order, is_public)
SELECT
  'sunjay', id, 'Teacher',
  'Artist, rock balancer and practitioner. A living archive of teachings, practices and creative explorations.',
  0, true
FROM users WHERE email = 'fnordj@gmail.com'
ON CONFLICT (org_id, user_id) DO UPDATE SET
  role_title   = COALESCE(NULLIF(org_profiles.role_title, ''), EXCLUDED.role_title),
  bio_override = COALESCE(NULLIF(org_profiles.bio_override, ''), EXCLUDED.bio_override),
  is_public    = org_profiles.is_public OR NOT org_profiles.self_hidden;
