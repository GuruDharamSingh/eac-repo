-- ============================================================================
-- Migration 061: Directory profiles — Artist Dossier + OAD fields
-- ============================================================================
-- Extends directory_profiles (060) to back two things:
--   1. The "Classified Artist Dossier" template (connector: dossier-classified)
--      — discrete fields the dossier sections bind to.
--   2. The Online Artist Directory (OAD): community-contributed, claimable,
--      verifiable artist pages. The dossier's "UNCLAIMED" stamp == claim_status.
--
-- All additive + nullable so the existing IFAC roster rows are unaffected.
-- ============================================================================

BEGIN;

ALTER TABLE directory_profiles
  -- Dossier display fields ---------------------------------------------------
  ADD COLUMN IF NOT EXISTS location             TEXT,
  ADD COLUMN IF NOT EXISTS dossier_status       TEXT,                       -- e.g. "ACTIVE — MONITOR CLOSELY"
  ADD COLUMN IF NOT EXISTS current_targets      TEXT[] NOT NULL DEFAULT '{}',   -- intelligence: in-progress work
  ADD COLUMN IF NOT EXISTS projected_movements  TEXT[] NOT NULL DEFAULT '{}',   -- intelligence: upcoming
  ADD COLUMN IF NOT EXISTS verified_contacts    TEXT[] NOT NULL DEFAULT '{}',   -- network: confirmed collaborators
  ADD COLUMN IF NOT EXISTS wanted_accomplices   TEXT[] NOT NULL DEFAULT '{}',   -- network: seeking
  ADD COLUMN IF NOT EXISTS operations           JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{title,date,details,image_url}]
  ADD COLUMN IF NOT EXISTS financial_channels   JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{title,description,url}]

  -- OAD provenance / claim / verification ------------------------------------
  ADD COLUMN IF NOT EXISTS created_by           TEXT,                       -- who submitted this entry
  ADD COLUMN IF NOT EXISTS claim_status         TEXT NOT NULL DEFAULT 'unclaimed'
    CHECK (claim_status IN ('unclaimed', 'pending', 'claimed')),
  ADD COLUMN IF NOT EXISTS claimed_by           TEXT,                       -- user_id who claimed it
  ADD COLUMN IF NOT EXISTS verified             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_note          TEXT;                       -- wiki-style attribution / sourcing

CREATE INDEX IF NOT EXISTS idx_directory_profiles_claim
  ON directory_profiles (org_id, claim_status, verified);

COMMIT;
