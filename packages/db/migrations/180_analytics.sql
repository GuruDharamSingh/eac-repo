-- ============================================================================
-- Migration 180: analytics_events, user_site_visits (2026-10-01)
-- ============================================================================
-- First-party, cookieless visit analytics for every network site
-- (packages/analytics). Written by the collector route each app mounts at
-- /api/pulse; read by the shared dashboard (/hub/analytics, /manage/analytics).
--
-- analytics_events: one row per page view or named event.
--   - visitor_id is a salted hash of (day, ip, user-agent, host); the salt
--     rotates daily and is derived from a server secret, so the same person is
--     not linkable across days or sites and the IP is never stored.
--   - session_id groups a visitor's page views with gaps under 30 minutes; the
--     entry page view's id is the session id.
--   - is_private rows (non-public threads, orgs that are private by default)
--     keep org, time, device and country only: path, thread_id and referrer
--     are NULL, so they count toward totals but never name a page.
--   - thread_id has no foreign key on purpose: counts outlive an archived or
--     deleted thread.
--   - country/region come from a local GeoLite2 City database when present.
--
-- user_site_visits: one row per signed-in user per org site — first and last
-- seen, visits (sessions) and page views. Feeds "returning members" and people
-- pages. users.last_seen_at is also refreshed by the collector (it was only
-- written by pigeonshoot and the LMS before).
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  org_id         VARCHAR(50)   REFERENCES organizations(id) ON DELETE CASCADE,
  host           TEXT          NOT NULL,
  kind           VARCHAR(12)   NOT NULL DEFAULT 'pageview',
  name           VARCHAR(60),
  props          JSONB,
  path           TEXT,
  thread_id      VARCHAR(21),
  is_private     BOOLEAN       NOT NULL DEFAULT FALSE,
  visitor_id     TEXT          NOT NULL,
  session_id     UUID          NOT NULL,
  is_entry       BOOLEAN       NOT NULL DEFAULT FALSE,
  user_id        UUID          REFERENCES users(id) ON DELETE SET NULL,
  source_kind    VARCHAR(12),
  referrer_host  TEXT,
  utm_source     TEXT,
  utm_medium     TEXT,
  utm_campaign   TEXT,
  country        CHAR(2),
  region         VARCHAR(80),
  device         VARCHAR(10),
  browser        VARCHAR(30),
  os             VARCHAR(30),
  duration_ms    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_org_time
  ON analytics_events(org_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_time
  ON analytics_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_thread
  ON analytics_events(thread_id, occurred_at DESC) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor
  ON analytics_events(visitor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session
  ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user
  ON analytics_events(user_id, occurred_at DESC) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_site_visits (
  user_id        UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id         VARCHAR(50)   NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_seen_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  last_seen_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  visit_count    INTEGER       NOT NULL DEFAULT 0,
  page_count     INTEGER       NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_user_site_visits_org
  ON user_site_visits(org_id, last_seen_at DESC);

COMMENT ON TABLE analytics_events IS
  'Page views and named events from the first-party collector (packages/analytics). Cookieless: visitor_id is a daily-rotating salted hash; no IP stored. is_private rows carry no path, thread or referrer.';
COMMENT ON TABLE user_site_visits IS
  'Per signed-in user and org site: first/last seen, visits (sessions) and page views. Maintained by the analytics collector.';
