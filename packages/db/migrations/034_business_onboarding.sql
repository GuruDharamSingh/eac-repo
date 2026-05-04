-- ============================================================================
-- Migration 034: Business Onboarding
-- ============================================================================
-- Adds fields to artist_profiles for the "Structure Your Business" workbook.
-- ============================================================================

BEGIN;

ALTER TABLE artist_profiles
  -- Section 1: Economic Flow
  ADD COLUMN IF NOT EXISTS revenue_sharing_model         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS overhead_commission           VARCHAR(20),
  ADD COLUMN IF NOT EXISTS member_dues_frequency         VARCHAR(20),
  ADD COLUMN IF NOT EXISTS financial_transparency_access VARCHAR(30),

  -- Section 2: Governance
  ADD COLUMN IF NOT EXISTS primary_decision_method       VARCHAR(30),
  ADD COLUMN IF NOT EXISTS membership_roles              TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dispute_resolution_process    TEXT,
  ADD COLUMN IF NOT EXISTS membership_admission          VARCHAR(30),

  -- Section 3: Logistics
  ADD COLUMN IF NOT EXISTS inventory_tracking_system     VARCHAR(30),
  ADD COLUMN IF NOT EXISTS fulfillment_responsibility    VARCHAR(30),
  ADD COLUMN IF NOT EXISTS digital_presence_type          TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS admin_load_rotation           VARCHAR(30),

  -- Section 4: Sustainability
  ADD COLUMN IF NOT EXISTS minimal_viable_income         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS emergency_fund_target         VARCHAR(20),
  ADD COLUMN IF NOT EXISTS growth_reinvestment           VARCHAR(20),
  ADD COLUMN IF NOT EXISTS sustainability_benchmarks     TEXT[] NOT NULL DEFAULT '{}',

  -- Section 5: Shared Resources
  ADD COLUMN IF NOT EXISTS shared_resource_categories    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bulk_buying_agreements        TEXT,
  ADD COLUMN IF NOT EXISTS mutual_aid_funds              BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS skill_share_frequency         VARCHAR(20),
  ADD COLUMN IF NOT EXISTS work_trade_availability       BOOLEAN NOT NULL DEFAULT false;

COMMIT;
