-- 192 — user_connections: a person's own OAuth connections to outside
-- services (YouTube first). 2026-10-03.
--
-- The person brings their own Google Cloud OAuth client (client id + secret)
-- and connects it once; the platform keeps the refresh token so recordings can
-- be uploaded to that person's channel without them present.
-- client_secret_enc and refresh_token_enc are AES-256-GCM ciphertexts written
-- by packages/services/src/connections.ts; never store them in the clear.
-- oauth_state holds the pending authorisation (nonce, return URL, started_at)
-- between /api/connections/start and /api/connections/callback.

CREATE TABLE IF NOT EXISTS user_connections (
  id                 varchar(21) PRIMARY KEY,
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider           text NOT NULL,             -- 'youtube'
  label              text NOT NULL DEFAULT '',
  client_id          text NOT NULL,
  client_secret_enc  text NOT NULL,
  refresh_token_enc  text,
  scopes             text[] NOT NULL DEFAULT '{}',
  account_id         text,                      -- YouTube channel id
  account_name       text,                      -- channel title
  account_url        text,
  status             text NOT NULL DEFAULT 'pending',  -- pending | connected | error
  error              text,
  oauth_state        jsonb,
  connected_at       timestamptz,
  last_used_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_connections_user ON user_connections (user_id, created_at);
