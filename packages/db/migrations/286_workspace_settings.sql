-- 286_workspace_settings.sql
-- Workspace slice 6 (settings) + 4b (guide side): per-host settings and invite links.
-- ADDITIVE ONLY: two new tables. No existing table or row changes.
-- Hosts are keyed (host_type, host_id) as in 285 (host_type 'lms_run' today; a thread can host later).
-- The code treats settings and invites as absent until these exist (it tests for the tables), so it fails soft.
--
--   workspace_settings   the choices a workspace's guides make in Settings that the learning system has no column for:
--                        who may comment on journal entries, the pasted call link, and the email CHOICES (stored only;
--                        nothing sends from them yet, and the digest stays off until someone switches it on).
--   workspace_invites    invite links a guide creates to bring in people who have an account. The link carries a random
--                        token; only its SHA-256 hash is stored.
--
-- NOT APPLIED by the worker who wrote it: the PM applies migrations.

CREATE TABLE IF NOT EXISTS workspace_settings (
  host_type    VARCHAR(16)  NOT NULL CHECK (host_type IN ('lms_run', 'thread')),
  host_id      TEXT         NOT NULL,
  -- Who may comment on journal entries: only the guides, or everyone in the group.
  comments_by  VARCHAR(10)  NOT NULL DEFAULT 'everyone' CHECK (comments_by IN ('guide', 'everyone')),
  -- A pasted call link (Zoom, Meet, Jitsi ...) shown to the group. Plain https URL, checked by the code.
  call_url     TEXT,
  -- Email choices, STORED ONLY. Nothing reads these to send mail in this slice.
  email_to     VARCHAR(10)  NOT NULL DEFAULT 'guide' CHECK (email_to IN ('everyone', 'guide', 'nobody')),
  email_when   VARCHAR(10)  NOT NULL DEFAULT 'each' CHECK (email_when IN ('each', 'digest')),
  email_remind BOOLEAN      NOT NULL DEFAULT FALSE,
  -- The weekly digest is OFF until someone says so.
  digest_on    BOOLEAN      NOT NULL DEFAULT FALSE,
  updated_by   UUID         REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (host_type, host_id)
);

CREATE TABLE IF NOT EXISTS workspace_invites (
  id          TEXT         PRIMARY KEY,
  host_type   VARCHAR(16)  NOT NULL CHECK (host_type IN ('lms_run', 'thread')),
  host_id     TEXT         NOT NULL,
  token_hash  TEXT         NOT NULL UNIQUE,
  label       VARCHAR(80),
  created_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  max_uses    INTEGER      CHECK (max_uses IS NULL OR max_uses > 0),
  uses        INTEGER      NOT NULL DEFAULT 0,
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_host ON workspace_invites (host_type, host_id);
