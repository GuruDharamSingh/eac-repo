-- 217: publish targets on a connection (2026-10-29).
-- A Meta (Facebook) connection may publish to several Pages, each with its own
-- Page token and optional linked Instagram account; Threads has one profile.
-- Stored as a list; page tokens inside are sealed like refresh_token_enc.
ALTER TABLE user_connections
  ADD COLUMN IF NOT EXISTS targets jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- When the stored token was last exchanged/refreshed (Meta long-lived user
  -- tokens and Threads tokens expire after ~60 days unless refreshed).
  ADD COLUMN IF NOT EXISTS token_refreshed_at timestamptz;
