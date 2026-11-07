-- 245: action_events — one append-only row per call into the action registry (2026-11-06).
--
-- Written by performAction (packages/actions/src/server/run.ts) for every call
-- that has a signed-in actor, refusals included: entry id, actor, org, the door
-- it came through (`via`: 'app' server action, 'http' actionRoutes), the
-- validated input, and the outcome (`code` says whose refusal it was). Brief: docs/open/LMS_ACTION_LAYER_BRIEF_2026-11-06.md
-- §5 phase 4 and §7.2 (an audit row per call before any wider write path).
--
-- Shape follows lms_events (migration 142): no foreign keys, so deleting a user
-- or an org leaves the record; actor_type uses the same three values; rows
-- cannot be updated or deleted.

CREATE TABLE IF NOT EXISTS action_events (
  id           bigserial PRIMARY KEY,
  action_id    varchar(60) NOT NULL,
  actor_id     uuid,
  actor_type   varchar(8) NOT NULL DEFAULT 'human'
               CHECK (actor_type IN ('human', 'ai', 'system')),
  org_id       varchar(50),
  via          varchar(20) NOT NULL DEFAULT 'app',
  input        jsonb,
  ok           boolean NOT NULL,
  error        text,
  -- performAction's own refusal (auth, unknown, input, forbidden, failed); NULL when the entry refused.
  code         varchar(12),
  result       jsonb,
  duration_ms  integer,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_events_actor ON action_events (actor_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_action_events_org ON action_events (org_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_action_events_action ON action_events (action_id, occurred_at);

CREATE OR REPLACE FUNCTION action_events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'action_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_action_events_append_only ON action_events;
CREATE TRIGGER trg_action_events_append_only
  BEFORE UPDATE OR DELETE ON action_events
  FOR EACH ROW EXECUTE FUNCTION action_events_append_only();

-- Migration 227's default privileges grant eac_tenant every new table. This one
-- holds every org's rows and is read and written by the platform role only.
REVOKE ALL ON action_events FROM eac_tenant;
REVOKE ALL ON SEQUENCE action_events_id_seq FROM eac_tenant;

COMMENT ON TABLE action_events IS
  'Append-only record of calls into the action registry (@elkdonis/actions performAction). Migration 245, 2026-11-06.';
