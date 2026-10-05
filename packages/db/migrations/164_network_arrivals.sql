-- ============================================================================
-- Migration 164: network_arrivals (2026-09-25)
-- ============================================================================
-- One row per signed-in arrival on a network site through the SSO handoff
-- (packages/auth-server/src/handoff.ts, recordArrival): who arrived, on which
-- org's site, from which site, and when. Read by the org's people page and by
-- the arrival notice that offers to follow the org.
--
-- Rows are written only when they carry information: a known source site, or
-- the person's first arrival on that host. from_host is NULL for a direct
-- arrival (typed address, bookmark). from_org_id is resolved from org_domains
-- when the source host is registered there, else NULL.
-- ============================================================================

CREATE TABLE IF NOT EXISTS network_arrivals (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id       VARCHAR(50)   REFERENCES organizations(id) ON DELETE SET NULL,
  host         TEXT          NOT NULL,
  path         TEXT,
  from_host    TEXT,
  from_org_id  VARCHAR(50)   REFERENCES organizations(id) ON DELETE SET NULL,
  arrived_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_network_arrivals_org ON network_arrivals(org_id, arrived_at DESC);
CREATE INDEX IF NOT EXISTS idx_network_arrivals_user_host ON network_arrivals(user_id, host);

COMMENT ON TABLE network_arrivals IS
  'Signed-in arrivals on a network site via the SSO handoff: user, destination org/host/path, source host/org, time. Written by auth-server handoff accept.';
