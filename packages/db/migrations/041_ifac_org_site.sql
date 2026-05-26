-- ==========================================================================
-- Migration 041: IFAC organization and per-org site sections
-- ==========================================================================

BEGIN;

INSERT INTO organizations (id, name, slug, description)
VALUES (
  'ifac',
  'International Fine Art Collectors',
  'ifac',
  'Online gallery and artist community representing independent fine artists and art dealers.'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS org_site_sections (
  org_id      VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  section_key TEXT        NOT NULL,
  content     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_org_site_sections_org ON org_site_sections(org_id);
CREATE INDEX IF NOT EXISTS idx_org_site_sections_updated ON org_site_sections(org_id, updated_at DESC);

INSERT INTO org_site_sections (org_id, section_key, content)
VALUES
  ('ifac', 'hero', '{"eyebrow":"IFAC","title":"International Fine Art Collectors","subtitle":"An online gallery and artist community connecting collectors with independent fine artists and art dealers around the world.","imageUrl":"https://ifacgroup.com/images/img-banner.jpg","primaryCta":"Join the collector list","secondaryCta":"View gallery"}'::jsonb),
  ('ifac', 'signup', '{"title":"Sign up for openings and collector notes","body":"Collectors, artists and dealers can join the IFAC list for exhibition announcements, private previews and membership follow-up."}'::jsonb),
  ('ifac', 'rsvp', '{"title":"RSVP for IFAC events","body":"Use this live RSVP area for openings, online previews, artist talks and dealer salons."}'::jsonb)
ON CONFLICT (org_id, section_key) DO NOTHING;

COMMIT;
