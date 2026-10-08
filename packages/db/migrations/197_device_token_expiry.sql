-- 197 — device_tokens.expires_at: device tokens stop being permanent.
-- 2026-10-08.
--
-- Until now a device token (migration 194) never expired and signed in to
-- every app on the network. packages/auth-server/src/device-tokens.ts now
-- accepts a token only for the app it was linked for and only while
-- expires_at is in the future. Each use slides expires_at to 30 days ahead,
-- capped at 180 days after created_at; POST /api/mobile/v1/token (elastrocal)
-- exchanges a live token for a fresh one. Tokens linked before this migration
-- get 30 days from now.

ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE device_tokens SET expires_at = now() + interval '30 days' WHERE expires_at IS NULL;

ALTER TABLE device_tokens
  ALTER COLUMN expires_at SET DEFAULT now() + interval '30 days',
  ALTER COLUMN expires_at SET NOT NULL;
