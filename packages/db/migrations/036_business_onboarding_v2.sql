-- ============================================================================
-- Migration 036: Business Onboarding v2 (Approachable)
-- ============================================================================
-- Adds fields to artist_profiles for the simplified "Structure Your Business" 
-- workbook, focusing on novice-friendly creative business questions.
-- ============================================================================

BEGIN;

ALTER TABLE artist_profiles
  -- Section 1: The Creative Entity
  ADD COLUMN IF NOT EXISTS biz_entity_type          VARCHAR(50),
  ADD COLUMN IF NOT EXISTS biz_entity_name          VARCHAR(120),
  ADD COLUMN IF NOT EXISTS biz_mission              TEXT,
  ADD COLUMN IF NOT EXISTS biz_legal_status         VARCHAR(50),

  -- Section 2: Offerings & Value
  ADD COLUMN IF NOT EXISTS biz_primary_revenue      TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS biz_capacity             VARCHAR(200),
  ADD COLUMN IF NOT EXISTS biz_pricing_philosophy   VARCHAR(50),

  -- Section 3: Logistics & Operations
  ADD COLUMN IF NOT EXISTS biz_tools                VARCHAR(200),
  ADD COLUMN IF NOT EXISTS biz_fulfillment          VARCHAR(50),
  ADD COLUMN IF NOT EXISTS biz_inventory_management TEXT,

  -- Section 4: Collective Cohesion
  ADD COLUMN IF NOT EXISTS biz_desired_resources    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS biz_revenue_sharing      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS biz_skill_share          TEXT,

  -- Section 5: Growth & Sustainability
  ADD COLUMN IF NOT EXISTS biz_main_barrier         TEXT,
  ADD COLUMN IF NOT EXISTS biz_revenue_goal         VARCHAR(100);

COMMIT;
