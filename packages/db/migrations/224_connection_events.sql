-- 224: connection_events — what happened to each person's outside connections (2026-11-01).
--
-- Append-only. One row per event on a user_connections row: created,
-- connected, connect_failed, token_used (by the person or by a system
-- actor such as the upload worker), tested, page_attached, channel_set,
-- channel_cleared, removed, revoke_attempted. No foreign key to the
-- connection: the history outlives the row. The Connections tab shows the
-- person their own recent rows; that is the "we act only on your click"
-- promise made checkable.

CREATE TABLE IF NOT EXISTS connection_events (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connection_id varchar(21) NOT NULL,
  provider      text NOT NULL,
  event         text NOT NULL,
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb,
  at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS connection_events_user_idx ON connection_events (user_id, at DESC);
