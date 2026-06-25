-- Org service tier (drives Nextcloud storage quota) and persistent org Talk room.
--
-- tier: 'free' | 'standard' | 'patron' — quota mapping lives in
--   packages/nextcloud/src/org-provisioning.ts (TIER_QUOTAS).
-- talk_room_token: token of the org's persistent Nextcloud Talk room
--   (per-event rooms continue to live on threads.nextcloud_talk_token).

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS tier VARCHAR(20) NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS talk_room_token VARCHAR(64) DEFAULT NULL;

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_tier_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_tier_check
  CHECK (tier IN ('free', 'standard', 'patron'));
