-- ============================================================================
-- 234: tour_render_requests — fly-over film requests for elktours (2026-11-02).
--
-- Lifecycle:
--   requested --accept (owner; freezes payload)--> accepted --claim--> claimed
--     --heartbeat--> rendering --complete--> delivered
--   requested/accepted --reject--> rejected, --cancel--> cancelled
--   retryable fail with attempts < max_attempts --> accepted; otherwise failed
--   stale heartbeat (> 20 min) --> re-claimable (attempts + 1)
--
-- The worker (Justin's PC, ElkTourUnity) talks to
-- apps/elktours/scripts/render-jobs.mts over SSH: claim / heartbeat /
-- complete / fail. It renders from `payload` (frozen at accept: route legs,
-- stops {id,position,title,lat,lng,placeId,experienceId}, style, limits
-- {maxSeconds: 30}), never from live rows. No stills or Street View data ever
-- go into a payload.
--
-- Delivered films land as hidden tour_assets (visible = false) unless
-- auto_publish is set (default off).
--
-- Spec: docs/open/ELKTOURS_PIPELINE_READINESS_2026-11-02.md Proposal (b),
-- docs/open/ELKTOURS_EXPERIENCES_SPEC_2026-11-02.md §1.3.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tour_render_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id       varchar(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  kind            text NOT NULL DEFAULT 'flyover' CHECK (kind IN ('flyover')),
  status          text NOT NULL DEFAULT 'requested' CHECK (status IN
                    ('requested','accepted','claimed','rendering','delivered','failed','rejected','cancelled')),
  -- NULL = anonymous visitor (Phase B).
  requested_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  requester_email text,
  note            text,
  style           jsonb NOT NULL DEFAULT '{"camera":"mapcam","routeLine":"waveform","highlights":false}'::jsonb,
  -- Frozen at accept. See header.
  payload         jsonb,
  payload_sha256  text,
  priority        integer NOT NULL DEFAULT 0,
  accepted_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  accepted_at     timestamptz,
  rejected_reason text,
  -- e.g. 'justin-pc'
  worker_id       text,
  claimed_at      timestamptz,
  heartbeat_at    timestamptz,
  started_at      timestamptz,
  finished_at     timestamptz,
  attempts        integer NOT NULL DEFAULT 0,
  max_attempts    integer NOT NULL DEFAULT 3,
  progress        real NOT NULL DEFAULT 0,
  -- Mirrors the PC exit code: bad_input | network | tiles_timeout | gate_failed | gpu | encode | ...
  error_code      text,
  error           text,
  -- Worker manifest: checks, metrics, hashes, timings.
  result          jsonb,
  delivered_asset_ids uuid[] NOT NULL DEFAULT '{}',
  -- On delivery, make the film the visible hero. Off by default (Phase A).
  auto_publish    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tour_render_requests_queue
  ON tour_render_requests (priority DESC, accepted_at) WHERE status = 'accepted';
CREATE INDEX IF NOT EXISTS tour_render_requests_thread
  ON tour_render_requests (thread_id, created_at DESC);
-- One open request per tour.
CREATE UNIQUE INDEX IF NOT EXISTS tour_render_requests_one_open ON tour_render_requests (thread_id, kind)
  WHERE status IN ('requested','accepted','claimed','rendering');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tour_assets_render_fk') THEN
    ALTER TABLE tour_assets ADD CONSTRAINT tour_assets_render_fk
      FOREIGN KEY (render_request_id) REFERENCES tour_render_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE tour_render_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tour_render_requests;
CREATE POLICY tenant_isolation ON tour_render_requests FOR ALL TO eac_tenant
  USING (org_id::text = app_org_id()) WITH CHECK (org_id::text = app_org_id());
