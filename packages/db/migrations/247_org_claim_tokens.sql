-- ============================================================================
-- 247: org_claim_tokens — one-time links that hand an org (and its store) to
-- its real owner.
--
-- The platform's handover practice: a site is set up on a placeholder account
-- (an org owner row plus a marketplace store), and when the person it is for
-- signs up, an owner of the org (or a network admin) creates a claim link.
-- Opening it signed in, and confirming, makes that person the org's owner and
-- moves the store to them (apps/katie-the-potter/src/lib/manage-claim.ts is
-- the first user; the table is not specific to that app).
--
-- Only a SHA-256 of the token is stored: a database read never yields a
-- usable link. A token is single-use (consumed_at), expires (expires_at), and
-- creating a new one revokes the org's earlier unused ones (revoked_at).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS org_claim_tokens (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash   text        NOT NULL UNIQUE,
  created_by   uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  consumed_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  revoked_at   timestamptz,
  -- What the claim moved, for the record and for a manual revert.
  result       jsonb       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_org_claim_tokens_org ON org_claim_tokens (org_id, created_at DESC);

COMMIT;
