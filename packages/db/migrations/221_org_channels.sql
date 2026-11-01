-- 221: org_channels — which outside accounts are an organisation's own (2026-11-01).
--
-- The Page (or Instagram account, Threads profile, YouTube channel) is the
-- org's asset on the platform's side; tokens stay with people. A post filed
-- under an org may go out only to a channel listed here, and only through
-- the clicking member's own connection that holds it, so no token ever
-- passes between members and the channel survives a member leaving.
--   provider 'meta'      external_id = Facebook Page id (covers its linked Instagram)
--   provider 'instagram' external_id = Instagram user id (Instagram Login, no Page)
--   provider 'threads'   external_id = Threads user id
--   provider 'youtube'   external_id = channel id

CREATE TABLE IF NOT EXISTS org_channels (
  org_id      varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider    text NOT NULL,
  external_id text NOT NULL,
  label       text NOT NULL DEFAULT '',
  set_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, provider, external_id)
);
