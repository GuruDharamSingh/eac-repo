/**
 * Migration 006: Nextcloud User Credentials
 * Date: 2025-11-01
 *
 * Adds app password storage and sync status for Nextcloud user authentication.
 * This enables per-user API access to Nextcloud services (Polls, Files, Talk, etc.)
 */

-- Add Nextcloud app password column (if not exists from previous migration run)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS nextcloud_app_password VARCHAR(500);

-- Add Nextcloud sync status column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS nextcloud_synced BOOLEAN DEFAULT FALSE;

-- Add index for Nextcloud user lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_nextcloud_user
ON users(nextcloud_user_id)
WHERE nextcloud_user_id IS NOT NULL;

-- Add index for synced users
CREATE INDEX IF NOT EXISTS idx_users_nextcloud_synced
ON users(nextcloud_synced)
WHERE nextcloud_synced = TRUE;

-- Comments for documentation
COMMENT ON COLUMN users.nextcloud_app_password IS 'App password for Nextcloud API access (per-user authentication)';
COMMENT ON COLUMN users.nextcloud_user_id IS 'Nextcloud username (typically same as EAC user UUID)';
COMMENT ON COLUMN users.nextcloud_synced IS 'Whether user account has been provisioned in Nextcloud';
