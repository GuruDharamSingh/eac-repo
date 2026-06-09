-- ============================================================================
-- Migration 060: Directory profiles (org-curated artist/dealer roster)
-- ============================================================================
-- A multi-tenant directory of artist & dealer profiles that an organization
-- curates. Distinct from `artist_profiles`, which is keyed to a real user
-- account + that user's own subdomain org (the arts-collective product).
--
-- Directory entries are roster members the org publishes about — they need not
-- have an account. `user_id` is an optional graduation link for when a roster
-- member later claims their own account/site.
--
-- First consumer: IFAC (org_id = 'ifac'), rebuilding the legacy static
-- artists/ and dealers/ pages as DB-backed, template-driven, eventually
-- Silex-composable pages.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS directory_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        TEXT NOT NULL,
  slug          TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'artist' CHECK (kind IN ('artist', 'dealer')),
  name          TEXT NOT NULL,
  role          TEXT,
  bio           JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of paragraph strings
  portrait_url  TEXT,
  artworks      JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ "url": "...", "title": "..." }]
  links         JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ "label": "...", "href": "..." }]
  email         TEXT,
  website       TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  user_id       TEXT,  -- optional link to a real account (graduation path)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_directory_profiles_org_kind
  ON directory_profiles (org_id, kind, status, sort_order);

COMMIT;
