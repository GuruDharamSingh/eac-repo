-- 295: a person's Google Calendar connected to one site's schedule (2026-11-26).
--
-- One row per (person, org). The person consents at Google to the
-- calendar.app.created scope: the site makes its own calendar in their account
-- and can touch nothing else in it. The site then writes its runs into that
-- calendar (services/google-calendar.ts). One way, site to Google.
--
-- Not a user_connections row: that table feeds the Connections panel, posting
-- and token maintenance on every app, which only know the publishing providers.
--
-- refresh_token_enc is sealed as user_connections secrets are
-- (services/connections.ts, CONNECTIONS_KEY).

CREATE TABLE IF NOT EXISTS google_calendar_links (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id            varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- The OAuth client the token was issued to.
  client_id         text NOT NULL,
  refresh_token_enc text,
  google_email      text,
  -- The calendar made in the person's account; NULL until the first sync.
  calendar_id       text,
  -- 'mine' = runs the person guides; 'all' = every run (owners).
  which             text NOT NULL DEFAULT 'mine' CHECK (which IN ('mine', 'all')),
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'error')),
  error             text,
  oauth_state       jsonb,
  connected_at      timestamptz,
  last_synced_at    timestamptz,
  event_count       integer,
  -- Fingerprint of what was last written: Google is only called when the schedule differs.
  content_hash      text,
  -- Set while a sync is writing, so two processes do not both make a calendar.
  syncing_since     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_google_calendar_links_org ON google_calendar_links (org_id) WHERE status = 'connected';

-- Row-level security as migration 265: policies bind only eac_tenant.
ALTER TABLE google_calendar_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON google_calendar_links;
CREATE POLICY tenant_isolation ON google_calendar_links FOR ALL TO eac_tenant
  USING (org_id::text = app_org_id())
  WITH CHECK (org_id::text = app_org_id());
