-- ============================================================================
-- Migration 073: Per-org feeds, and guide/teacher pages on artist_profiles
-- ============================================================================
-- Two related changes, both driven by the amrit_canada rebuild but both
-- deliberately org-agnostic so the next site inherits them.
--
-- (a) org_feeds — named sections of a site ("Amrit Vela", "Yoga Classes",
--     "Gurdwara & Langar"). Replaces the hardcoded
--       threads.section CHECK IN ('amrit_vela','yoga','gurdwara')
--     which baked ONE app's page structure into the shared schema. The
--     column stays; it now holds a feed slug and the allowed values come
--     from data instead of DDL. Adding a section to any site becomes a row.
--
--     No FK from threads(org_id, section) → org_feeds(org_id, slug), on
--     purpose: the read layer across these apps is fail-soft (queries
--     try/catch to [] rather than erroring), and a bad section should
--     degrade to an empty feed, not a failed publish.
--
-- (b) artist_profiles gains slug / role_title / sort_order / is_public so a
--     site can publish a page per teacher or guide. Migration 044 already
--     dropped the UNIQUE(org_id) index and made the wizard columns nullable,
--     so this is purely additive.
--
--     is_public defaults FALSE. Every member signup auto-creates an is_stub
--     profile (see auth-server/api-routes.ts), so an opt-out default would
--     dump thousands of empty stubs onto public rosters. Publishing is an
--     explicit act by an org owner.
--
-- Also seeds amrit_canada: its three feeds, its site copy, and Guru Dharam
-- Singh's guide profile. Seed blocks tolerate a missing user row.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- (a) org_feeds
-- ---------------------------------------------------------------------------

ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_section_check;

CREATE TABLE IF NOT EXISTS org_feeds (
  org_id      VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug        VARCHAR(50)  NOT NULL,
  name        VARCHAR(120) NOT NULL,
  tagline     TEXT,
  description TEXT,
  -- Credits a distinct real-world entity without making it a separate tenant.
  -- e.g. the gurdwara feed is presented by Guru Ram Dass Ashram, which is its
  -- own organisation in life but not in this database.
  presenter   VARCHAR(160),
  accent      VARCHAR(7),
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  is_public   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_org_feeds_org ON org_feeds(org_id, sort_order);

COMMENT ON TABLE org_feeds IS
  'Named content sections of an org site. threads.section holds the slug (soft reference, no FK — reads are fail-soft by convention).';
COMMENT ON COLUMN org_feeds.presenter IS
  'Real-world entity presenting this feed, for credit lines. Not a tenant.';

-- ---------------------------------------------------------------------------
-- (b) Guide/teacher pages
-- ---------------------------------------------------------------------------

ALTER TABLE artist_profiles
  ADD COLUMN IF NOT EXISTS slug       VARCHAR(80),
  ADD COLUMN IF NOT EXISTS role_title VARCHAR(120),
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_public  BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_profiles_org_slug
  ON artist_profiles(org_id, slug) WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_artist_profiles_public
  ON artist_profiles(org_id, sort_order) WHERE is_public;

COMMENT ON COLUMN artist_profiles.is_public IS
  'Opt-in. Signup auto-creates is_stub profiles; only owner-published ones appear on a public roster.';
COMMENT ON COLUMN artist_profiles.slug IS
  'URL segment for the public profile page, e.g. /about/guru-dharam-singh. Unique per org.';

-- ---------------------------------------------------------------------------
-- Seed: amrit_canada
-- ---------------------------------------------------------------------------

UPDATE organizations
   SET name = 'Amrit Canada',
       description = 'Kundalini Yoga and Sikh Dharma practice in Toronto — 4am Aquarian Sadhana, yoga classes, and gurdwara service at Guru Ram Dass Ashram.'
 WHERE id = 'amrit_canada';

INSERT INTO org_feeds (org_id, slug, name, tagline, description, presenter, accent, sort_order) VALUES
  ('amrit_canada', 'amrit-vela', 'Amrit Vela',
   '4:00 AM Aquarian Sadhana',
   'Daily sadhana in the ambrosial hours, and the monthly gathering the whole sangat sits for together. Two and a half hours of Jap Ji, yoga and kirtan.',
   'Guru Ram Dass Ashram', '#E6B422', 1),
  ('amrit_canada', 'yoga', 'Yoga Classes',
   'Kundalini Yoga with Guru Dharam Singh',
   'Classes, workshops and monthly kirtan — taught by Guru Dharam Singh, and by teachers and communities he practises alongside.',
   'Amrit Canada', '#5A8A6A', 2),
  ('amrit_canada', 'gurdwara', 'Gurdwara & Langar',
   'Sikh service at 348 Palmerston Blvd',
   'Gurdwara service and langar, held when arranged in the third-floor space at Guru Ram Dass Ashram. All are welcome.',
   'Guru Ram Dass Ashram', '#8B2E2E', 3)
ON CONFLICT (org_id, slug) DO NOTHING;

INSERT INTO org_site_sections (org_id, section_key, content) VALUES
  ('amrit_canada', 'hero', '{"eyebrow":"Toronto","title":"Amrit Canada","subtitle":"Kundalini Yoga and Sikh Dharma practice, held at Guru Ram Dass Ashram on Palmerston Blvd.","primaryCta":"Amrit Vela","secondaryCta":"Yoga Classes"}'::jsonb),
  ('amrit_canada', 'about', '{"title":"Our Tradition","body":"Amrit Canada carries the practice of Kundalini Yoga as taught by Yogi Bhajan, alongside the living Sikh Dharma traditions that surround it. The daily discipline is Amrit Vela — rising before dawn to sit for Jap Ji, kriya and kirtan. Around that centre sit classes, gatherings and gurdwara service."}'::jsonb),
  ('amrit_canada', 'visiting', '{"title":"Visiting","address":"348 Palmerston Blvd, Toronto, Ontario","body":"The yoga space is on the third floor. Cover your head, remove your shoes at the door, and come as you are. If it is your first time, arrive a few minutes early and someone will show you where to sit.","notes":"Guru Ram Dass Ashram is a private residence as well as a practice space. Please treat it as someone''s home, because it is."}'::jsonb),
  ('amrit_canada', 'resources', '{"title":"Resources","body":"The texts and sheets used in daily practice."}'::jsonb),
  ('amrit_canada', 'footer', '{"body":"Amrit Canada · Guru Ram Dass Ashram · 348 Palmerston Blvd, Toronto","note":"Part of the Elkdonis Arts Collective network."}'::jsonb)
ON CONFLICT (org_id, section_key) DO NOTHING;

-- Guru Dharam Singh: correct the display name and publish his guide profile.
-- Skipped silently if the user row doesn't exist in this environment.
UPDATE users
   SET display_name = 'Guru Dharam Singh'
 WHERE email = 'gurudharamsingh@gmail.com'
   AND (display_name IS NULL OR display_name = 'gurudharamsingh');

INSERT INTO artist_profiles (
  user_id, org_id, display_name, slug, role_title, bio, city,
  is_stub, is_public, sort_order
)
SELECT
  u.id, 'amrit_canada', 'Guru Dharam Singh', 'guru-dharam-singh',
  'Teacher · Kundalini Yoga & Sikh Dharma',
  'Guru Dharam Singh lives, practises and teaches at Guru Ram Dass Ashram on Palmerston Blvd, where he holds the daily 4am Aquarian Sadhana. He teaches Kundalini Yoga in Toronto and leads a monthly Kirtan for Lotus Yoga.',
  'Toronto',
  FALSE, TRUE, 1
FROM users u
WHERE u.email = 'gurudharamsingh@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  org_id       = COALESCE(artist_profiles.org_id, EXCLUDED.org_id),
  display_name = COALESCE(artist_profiles.display_name, EXCLUDED.display_name),
  slug         = COALESCE(artist_profiles.slug,         EXCLUDED.slug),
  role_title   = COALESCE(artist_profiles.role_title,   EXCLUDED.role_title),
  bio          = COALESCE(artist_profiles.bio,          EXCLUDED.bio),
  city         = COALESCE(artist_profiles.city,         EXCLUDED.city),
  is_stub      = FALSE,
  is_public    = TRUE;

COMMIT;
