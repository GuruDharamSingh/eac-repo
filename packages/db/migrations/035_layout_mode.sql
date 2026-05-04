-- ============================================================================
-- Migration 034: Org layout mode + Silex publish metadata
-- ============================================================================
-- Adds opt-in routing metadata on organizations so we can switch a site to a
-- future Silex-rendered layout without changing behavior for existing orgs.
-- ============================================================================

BEGIN;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS layout_mode VARCHAR(20) NOT NULL DEFAULT 'default'
    CHECK (layout_mode IN ('default', 'silex')),
  ADD COLUMN IF NOT EXISTS silex_project_path VARCHAR(500),
  ADD COLUMN IF NOT EXISTS silex_published_path VARCHAR(500),
  ADD COLUMN IF NOT EXISTS silex_published_at TIMESTAMPTZ;

COMMIT;