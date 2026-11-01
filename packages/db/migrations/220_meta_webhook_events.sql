-- 220: meta_webhook_events — deliveries from Meta's webhooks (2026-10-31).
--
-- Every signed delivery to /api/{meta,instagram,threads}/webhook on the
-- network host is kept whole: `source` names the app, `object` is Meta's
-- top-level object ("page", "instagram", "threads"), `payload` the body.
-- Nothing reads it yet; it is the record for turning comments and mentions
-- into replies on the network later. The routes insert best effort, so they
-- answer Meta even before this table exists.

CREATE TABLE IF NOT EXISTS meta_webhook_events (
  id          bigserial PRIMARY KEY,
  source      text NOT NULL,
  object      text NOT NULL,
  payload     jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meta_webhook_events_received_idx ON meta_webhook_events (received_at DESC);
