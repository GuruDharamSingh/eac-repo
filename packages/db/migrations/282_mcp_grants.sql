-- NNN: mcp_grants + action_events.agent_id — the platform MCP's keys and its audit column (2026-11-08).
--
-- PARKED in docs/open/mcp-foundations/migrations/ until Justin approves the run. To apply:
-- copy to packages/db/migrations/<next free number>_mcp_grants.sql, then run it on
-- elkdonis_dev. Until it runs, /api/mcp answers 503 "not ready" (the key store is
-- missing) and tool-call audit rows are written without agent_id.
--
-- mcp_grants: one row per MCP key (later also per OAuth grant). The key is
-- `eacm_` + 32 random bytes; only its SHA-256 is stored. It opens /api/mcp only:
-- auth-server's device-token check (eacd_) never reads this table.
--   user_id    the person the agent speaks for (RFC 8693 `sub`)
--   client_id  who carries it (`act.sub`): 'personal' for an operator-minted key
--   org_scope  one organizations.id, or '*' = every org the person runs
--   scopes     space-separated: mcp:read (slice 1), mcp:draft (pass 2)
-- No foreign key on org_scope ('*' is not an org). Deleting the user deletes
-- their grants. Plan: docs/open/mcp-foundations/PLAN.md §2.3.

CREATE TABLE IF NOT EXISTS mcp_grants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id     varchar(200) NOT NULL DEFAULT 'personal',
  label         varchar(80) NOT NULL DEFAULT '',
  org_scope     varchar(50) NOT NULL,
  scopes        text NOT NULL DEFAULT 'mcp:read',
  token_hash    char(64) NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  CHECK (scopes ~ '^(mcp:(read|draft))( mcp:(read|draft))*$')
);

CREATE INDEX IF NOT EXISTS idx_mcp_grants_user ON mcp_grants (user_id, created_at);

-- The agent behind an action_events row (the grant id; later the OAuth client's grant).
-- Written by packages/mcp (tool calls) and, from pass 2, performAction's agent doors.
ALTER TABLE action_events ADD COLUMN IF NOT EXISTS agent_id varchar(64);
CREATE INDEX IF NOT EXISTS idx_action_events_agent ON action_events (agent_id, occurred_at) WHERE agent_id IS NOT NULL;

-- Migration 227's default privileges grant eac_tenant every new table. Keys are read
-- by the platform role only (as action_events, migration 245).
REVOKE ALL ON mcp_grants FROM eac_tenant;

COMMENT ON TABLE mcp_grants IS
  'Keys and grants for the platform MCP (packages/mcp, arts-collective /api/mcp). SHA-256 of the key only. 2026-11-08.';
