-- 194 — device_tokens: sign-in for the network's own apps (Jerusalem, Justin's
-- Android app, first). 2026-10-03.
--
-- A person signed in on the web links a device at /astro/link-device; the
-- device receives a long random bearer token (prefix eacd_) and sends it as
-- `Authorization: Bearer eacd_…`. Only the SHA-256 of the token is stored.
-- getServerSession (packages/auth-server/src/device-tokens.ts) accepts it
-- wherever a session cookie is accepted, so every existing route that reads
-- the session works for the device too. Revoking sets revoked_at.

CREATE TABLE IF NOT EXISTS device_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app           text NOT NULL,                 -- 'jerusalem'
  label         text NOT NULL DEFAULT '',      -- 'Galaxy S20+'
  token_hash    text NOT NULL UNIQUE,          -- sha256 hex of the bearer token
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

CREATE INDEX IF NOT EXISTS device_tokens_user ON device_tokens (user_id, created_at);
