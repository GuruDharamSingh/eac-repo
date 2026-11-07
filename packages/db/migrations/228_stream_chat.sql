-- 228: chat from the stream's destinations, collected in one place (2026-11-01)
--
-- The stream-chat service (packages/services/scripts/stream-chat.mts) follows
-- the ticked destinations that name a chat channel and writes each viewer
-- message here; the Studio's Chat panel reads it. Messages older than 30 days
-- are deleted by the same service. Plan:
-- docs/open/BROADCAST_BOOTH_AND_RELAY_PLAN_2026-11-01.md "Chat from every
-- destination in one place".

-- Twitch login or Kick slug; YouTube and Facebook take theirs from the
-- connection, so NULL there.
ALTER TABLE stream_destinations ADD COLUMN IF NOT EXISTS chat_channel text;

CREATE TABLE IF NOT EXISTS stream_chat_messages (
  id             bigserial PRIMARY KEY,
  destination_id uuid REFERENCES stream_destinations(id) ON DELETE SET NULL,
  platform       text NOT NULL,             -- twitch | youtube | facebook | kick
  channel        text NOT NULL,
  external_id    text NOT NULL,             -- the platform's message id
  author         text NOT NULL,
  author_id      text,
  body           text NOT NULL,
  meta           jsonb NOT NULL DEFAULT '{}'::jsonb,  -- colour, badges, reply-to
  sent_at        timestamptz NOT NULL,
  received_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);

CREATE INDEX IF NOT EXISTS stream_chat_messages_received_idx ON stream_chat_messages (received_at DESC);
