-- Per-member Nextcloud Talk guest sessions, for the hub's General Chat.
--
-- Our apps hold one Nextcloud identity (the service account), so anything it
-- posts is attributed to the robot — that is tolerable for a Deck card comment
-- and useless for a group chat, where every message would read as
-- `eac_intergration`. Talk has a way out that Deck does not: a public room
-- accepts GUEST participants, and a guest may set its own display name. Each
-- member therefore gets their own Talk guest session, and their messages
-- appear under their own name both in our UI and in Nextcloud.
--
-- cookie: the Nextcloud session for that guest, serialized as a Cookie header.
--   This is a CREDENTIAL — it authenticates as that guest participant. It is
--   read only by server-side code posting on the member's behalf, is never
--   sent to a browser, and is re-minted (not repaired) whenever Nextcloud has
--   expired it. Rows are disposable: deleting one costs a re-join, nothing more.
--
-- actor_id: Talk's opaque guest actor id for that session, used to tell a
--   member's own messages apart from everyone else's when rendering.

CREATE TABLE IF NOT EXISTS talk_guest_sessions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_token VARCHAR(64) NOT NULL,
  cookie TEXT NOT NULL,
  actor_id VARCHAR(128) NOT NULL,
  display_name VARCHAR(255),
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, room_token)
);

CREATE INDEX IF NOT EXISTS idx_talk_guest_sessions_room
  ON talk_guest_sessions (room_token);
