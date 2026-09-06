-- ============================================================================
-- Migration 079: Member-gated feeds, and the hidden-enneagram site sections
-- ============================================================================
-- (a) org_feeds.min_role — the missing half of feed access.
--
--     073 gave feeds `is_public`, and its own comment is explicit that the
--     flag is presentation only: "a private feed is hidden from public nav,
--     not secured". That was fine while every site was fully public. It isn't
--     now: these orgs want a members-only side — writing, recordings and
--     working notes that a signed-out visitor should not be able to read by
--     guessing the URL.
--
--     min_role is the gate is_public never was:
--       NULL     → anyone, signed in or not
--       'member' → any row in user_organizations for this org
--       'guide'  → guides and owners
--       'owner'  → owners
--
--     is_public keeps its old job (show in nav) and the two compose: a feed
--     can be listed in nav but member-only (visible lock), or unlisted and
--     public (a quiet page you share by link).
--
--     Enforcement lives in the read layer, not here — same posture as the
--     rest of this schema, where threads.visibility is likewise enforced in
--     queries. This column is what those queries read.
--
-- (b) Seeds hidden-enneagram's feeds and site copy, so the site has the same
--     data-driven shape amrit_canada got in 073: sections of the site are
--     rows, and the wording around them is rows too.
--
--     The About copy is org_site_sections rather than an artist_profiles row
--     because Ario has no account in this database yet, and a teacher page
--     hangs off a real user by design (073). When that account exists, the
--     /about page picks the profile up automatically alongside this copy.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- (a) Feed access level
-- ---------------------------------------------------------------------------

ALTER TABLE org_feeds
  ADD COLUMN IF NOT EXISTS min_role VARCHAR(20)
    CHECK (min_role IN ('member', 'guide', 'owner'));

COMMENT ON COLUMN org_feeds.min_role IS
  'Lowest org role that may read this feed. NULL = public. Enforced in the read layer, alongside threads.visibility.';

COMMENT ON COLUMN org_feeds.is_public IS
  'Show in site navigation. Presentation only — min_role is the access gate.';

-- ---------------------------------------------------------------------------
-- (b) hidden-enneagram: feeds
-- ---------------------------------------------------------------------------

INSERT INTO org_feeds (org_id, slug, name, tagline, description, accent, sort_order, is_public, min_role)
SELECT * FROM (VALUES
  ('hidden-enneagram', 'writing', 'Writing',
   'Notes on type, fixation and attention',
   'Essays and working notes on the enneagram — what the map is for, and what it cannot do.',
   '#3aa99c', 1, TRUE, NULL::varchar),
  ('hidden-enneagram', 'inner-work', 'Inner Work',
   'For people working with Ario',
   'Recordings, exercises and correspondence for members. Not public — this is the working material between sessions.',
   '#8a7bb5', 2, TRUE, 'member'::varchar)
) AS seed(org_id, slug, name, tagline, description, accent, sort_order, is_public, min_role)
WHERE EXISTS (SELECT 1 FROM organizations WHERE id = 'hidden-enneagram')
ON CONFLICT (org_id, slug) DO NOTHING;

-- The services feed (seeded in 078) sorts after the writing above it.
UPDATE org_feeds SET sort_order = 3 WHERE org_id = 'hidden-enneagram' AND slug = 'services';

-- ---------------------------------------------------------------------------
-- (b) hidden-enneagram: site copy
-- ---------------------------------------------------------------------------

INSERT INTO org_site_sections (org_id, section_key, content)
SELECT * FROM (VALUES
  ('hidden-enneagram', 'about', '{"title":"About Ario","roleTitle":"Musician · Educator · Workshop facilitator","location":"Los Angeles, USA","body":"Ario is a music educator and workshop facilitator working between rhythm and self-observation. He runs drum circle and rhythm attunement programs through Sangre House, and teaches the enneagram as a map of attention rather than a personality quiz.\n\nThe work here treats the nine types as habits of attention — where it goes by default, what it avoids, and what becomes available when the habit loosens. Sessions are one-on-one or in small groups.","links":"sangrehouse.com"}'::jsonb),
  ('hidden-enneagram', 'hero', '{"eyebrow":"A map of nine fixations","title":"The Hidden Enneagram","subtitle":"Formative developmental imprints — how core motivations harden into recurring psychological fixations."}'::jsonb),
  ('hidden-enneagram', 'footer', '{"body":"The Hidden Enneagram · Los Angeles","note":"Part of the Elkdonis Arts Collective network."}'::jsonb)
) AS seed(org_id, section_key, content)
WHERE EXISTS (SELECT 1 FROM organizations WHERE id = 'hidden-enneagram')
ON CONFLICT (org_id, section_key) DO NOTHING;

COMMIT;
