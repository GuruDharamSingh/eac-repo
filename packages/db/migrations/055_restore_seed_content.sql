-- ============================================================================
-- Migration 055: Restore fixed seed content lost to table wipes
-- ============================================================================
-- Several one-time seed INSERTs (migrations 041, 043, 045) only run once and
-- were lost when their tables were later wiped, leaving curated landing-page
-- content blank even though the owning migrations are marked applied:
--   * site_config       — elkdonis (3005) fundraising / featured artist / initiative
--   * reading_groups     — fourth_way_book_readers (3010) default group
--   * org_site_sections  — ifac hero / signup / rsvp copy
--
-- All inserts are idempotent (ON CONFLICT DO NOTHING) so admin edits are never
-- overwritten and a fresh DB is self-contained. Mirrors the originals exactly.
-- ============================================================================

-- --- site_config (elkdonis landing, port 3005) -----------------------------
INSERT INTO site_config (org_id, key, value) VALUES
  ('elkdonis', 'fundraising',
   '{"goal": 25000, "raised": 0, "currency": "CAD", "status": "We are just getting started. Every contribution goes directly to our artists and programs.", "url": "https://linktr.ee/elkdonisarts", "cta": "Support Our Work"}'::jsonb),
  ('elkdonis', 'featured_artist',
   '{"eyebrow": "Featured Arts", "name": "Dana McCool", "description": "Surrealist Writing", "image_url": "/danamccool.jpg", "cta": "Make an Inquiry"}'::jsonb),
  ('elkdonis', 'initiative',
   '{"eyebrow": "Current Offerings - Spring 2026", "heading": "Residency, Studios, Galleries", "body": "The collective has just purchased some beautiful secluded land close to conservation areas, and we are very excited to be developing from the ground up, a permaculture design principles aligned compound. The compound will feature permaculture food forest, artist residences, studios, and galleries. Horseback riding and hiking trails are nearby.", "cta": "Make an Inquiry", "stats": [{"value": "Food", "label": "Forest"}, {"value": "Artist", "label": "Residences"}, {"value": "Studios", "label": "Galleries"}]}'::jsonb)
ON CONFLICT (org_id, key) DO NOTHING;

-- --- reading_groups (fourth-way-book-readers, port 3010) --------------------
INSERT INTO reading_groups (id, org_id, name, slug, description, nextcloud_folder_path)
VALUES (
  'rg_4th_way',
  'fourth_way_book_readers',
  'Fourth Way Book Readers',
  'fourth-way-book-readers',
  'A weekly reading table for Fourth Way texts and related study materials.',
  'EAC-Network/fourth_way_book_readers/Reading'
)
ON CONFLICT (id) DO NOTHING;

-- --- org_site_sections (ifac, port 3008) ------------------------------------
INSERT INTO org_site_sections (org_id, section_key, content) VALUES
  ('ifac', 'hero',   '{"eyebrow":"IFAC","title":"International Fine Art Collectors","subtitle":"An online gallery and artist community connecting collectors with independent fine artists and art dealers around the world.","imageUrl":"https://ifacgroup.com/images/img-banner.jpg","primaryCta":"Join the collector list","secondaryCta":"View gallery"}'::jsonb),
  ('ifac', 'signup', '{"title":"Sign up for openings and collector notes","body":"Collectors, artists and dealers can join the IFAC list for exhibition announcements, private previews and membership follow-up."}'::jsonb),
  ('ifac', 'rsvp',   '{"title":"RSVP for IFAC events","body":"Use this live RSVP area for openings, online previews, artist talks and dealer salons."}'::jsonb)
ON CONFLICT (org_id, section_key) DO NOTHING;
