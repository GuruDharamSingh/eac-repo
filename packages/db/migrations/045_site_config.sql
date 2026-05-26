-- ============================================================================
-- Migration 045: Site config key-value store
-- ============================================================================
-- Simple per-org JSON config store for admin-editable content on the
-- public landing pages (fundraising status, featured artist, initiative copy).
-- Keys are free-form strings namespaced by org_id.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS site_config (
  org_id     VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key        VARCHAR(100) NOT NULL,
  value      JSONB        NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, key)
);

CREATE INDEX IF NOT EXISTS idx_site_config_org ON site_config(org_id);

-- Seed default fundraising config for the elkdonis org
INSERT INTO site_config (org_id, key, value) VALUES (
  'elkdonis',
  'fundraising',
  '{"goal": 25000, "raised": 0, "currency": "CAD", "status": "We are just getting started. Every contribution goes directly to our artists and programs.", "url": "https://linktr.ee/elkdonisarts", "cta": "Support Our Work"}'
) ON CONFLICT DO NOTHING;

INSERT INTO site_config (org_id, key, value) VALUES (
  'elkdonis',
  'featured_artist',
  '{"eyebrow": "Featured Arts", "name": "Dana McCool", "description": "Surrealist Writing", "image_url": "/danamccool.jpg", "cta": "Make an Inquiry"}'
) ON CONFLICT DO NOTHING;

INSERT INTO site_config (org_id, key, value) VALUES (
  'elkdonis',
  'initiative',
  '{"eyebrow": "Current Offerings - Spring 2026", "heading": "Residency, Studios, Galleries", "body": "The collective has just purchased some beautiful secluded land close to conservation areas, and we are very excited to be developing from the ground up, a permaculture design principles aligned compound. The compound will feature permaculture food forest, artist residences, studios, and galleries. Horseback riding and hiking trails are nearby.", "cta": "Make an Inquiry", "stats": [{"value": "Food", "label": "Forest"}, {"value": "Artist", "label": "Residences"}, {"value": "Studios", "label": "Galleries"}]}'
) ON CONFLICT DO NOTHING;

COMMIT;
