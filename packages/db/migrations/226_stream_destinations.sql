-- 226: stream_destinations + stream_events — the stream relay's outputs and history (2026-11-01).
--
-- stream_destinations: where the relay (docker/relay) copies the server OBS
-- program when someone goes live from the Studio's Go live card. Network-wide,
-- like the one OBS instance; admins only (checked in arts-collective's server
-- actions). key_enc is the stream key sealed with CONNECTIONS_KEY
-- (packages/services/src/relay.ts); it is unsealed only at Go live and sent to
-- the relay agent, which keeps it in memory. `enabled` is the checkbox on the
-- card: ticked destinations go out at the next Go live.
--
-- stream_events: append-only, one row per go_live, stop, destination_added,
-- destination_updated, destination_removed, feed_added, feed_removed. A stop row's
-- detail carries each output's summary from the relay (live seconds, bytes,
-- retries, last error). No foreign keys to destinations: history outlives rows.

CREATE TABLE IF NOT EXISTS stream_destinations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL,
  preset      text NOT NULL DEFAULT 'custom',
  server      text NOT NULL,
  key_enc     text NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  set_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stream_events (
  id              bigserial PRIMARY KEY,
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  event           text NOT NULL,
  destination_id  uuid,
  detail          jsonb NOT NULL DEFAULT '{}'::jsonb,
  at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stream_events_at_idx ON stream_events (at DESC);
