-- Migration 011: OIDC Codes Hardening (nonce + PKCE)
-- Adds optional columns used by the custom OIDC bridge.

ALTER TABLE oidc_codes
ADD COLUMN IF NOT EXISTS nonce TEXT,
ADD COLUMN IF NOT EXISTS code_challenge TEXT,
ADD COLUMN IF NOT EXISTS code_challenge_method VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_oidc_codes_expires_at_nonce
  ON oidc_codes(expires_at)
  WHERE nonce IS NOT NULL;

