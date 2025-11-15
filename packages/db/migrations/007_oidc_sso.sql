/**
 * Migration 007: OIDC/SAML SSO Integration
 *
 * Adds columns for Single Sign-On integration between Supabase GoTrue and Nextcloud
 * - OIDC subject identifier for user mapping
 * - SSO sync status tracking
 * - App password storage for API access
 */

-- Add OIDC columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS oidc_subject VARCHAR(255),
ADD COLUMN IF NOT EXISTS oidc_issuer VARCHAR(500),
ADD COLUMN IF NOT EXISTS nextcloud_oidc_synced BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS nextcloud_app_password TEXT;

-- Create unique index on OIDC subject to prevent duplicate SSO mappings
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oidc_subject
  ON users(oidc_subject)
  WHERE oidc_subject IS NOT NULL;

-- Index for looking up users by Nextcloud ID
CREATE INDEX IF NOT EXISTS idx_users_nextcloud_user_id
  ON users(nextcloud_user_id)
  WHERE nextcloud_user_id IS NOT NULL;

-- Index for SSO sync status queries
CREATE INDEX IF NOT EXISTS idx_users_nextcloud_oidc_synced
  ON users(nextcloud_oidc_synced)
  WHERE nextcloud_oidc_synced = FALSE;

-- Comments for documentation
COMMENT ON COLUMN users.oidc_subject IS 'OIDC subject identifier (sub claim) for SSO mapping';
COMMENT ON COLUMN users.oidc_issuer IS 'OIDC issuer URL for multi-provider support';
COMMENT ON COLUMN users.nextcloud_oidc_synced IS 'Whether user has been provisioned in Nextcloud via OIDC';
COMMENT ON COLUMN users.nextcloud_app_password IS 'Encrypted Nextcloud app password for API access (generated on first login)';
