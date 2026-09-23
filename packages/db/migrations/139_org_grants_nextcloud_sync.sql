-- ============================================================================
-- 139: org grants + the Nextcloud sync queue.
--
-- 1. `org_grants` — a capability the NETWORK admin hands an org, which that
--    org's owners may then use. One row per (org, capability); absence means
--    not granted. First capability: 'nextcloud_access' — owners may see who
--    in their org is linked to Nextcloud and ask for a sync. Written only by
--    the admin app (services' setOrgGrant checks users.is_admin); an org role
--    alone never grants anything here.
--
-- 2. `nextcloud_sync_requests` — Nextcloud access is derived state that only
--    scripts/sync-nextcloud-access.sh can reconcile, and it needs `occ` on the
--    Docker host, so no app container can run it. Apps write a request row
--    (an owner's "sync now", an approved claim); scripts/nc-sync-queue.sh on
--    the host claims pending rows, runs the sync once, and records the outcome.
--    At most one PENDING row per org (partial unique index) so repeated clicks
--    collapse into one run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_grants (
  org_id      VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  capability  VARCHAR(50) NOT NULL,
  granted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, capability),
  CONSTRAINT org_grants_capability_known CHECK (capability IN ('nextcloud_access'))
);

CREATE TABLE IF NOT EXISTS nextcloud_sync_requests (
  id            BIGSERIAL PRIMARY KEY,
  org_id        VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  reason        VARCHAR(40) NOT NULL DEFAULT 'manual',
  status        VARCHAR(12) NOT NULL DEFAULT 'pending',
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  -- Tail of the run's output on failure, so an owner sees more than "failed".
  detail        TEXT,
  CONSTRAINT nextcloud_sync_requests_status CHECK (status IN ('pending', 'running', 'done', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nc_sync_one_pending_per_org
  ON nextcloud_sync_requests (org_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_nc_sync_org_recent
  ON nextcloud_sync_requests (org_id, requested_at DESC);
