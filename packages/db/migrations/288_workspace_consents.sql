-- 288_workspace_consents.sql
-- Workspace experiment preset: the consent to take part (design: docs/open/DEVELOPMENT_APP_2026-11-20/workspace-threads.md, section 5).
-- ADDITIVE ONLY: one nullable-by-default column on workspace_settings (286) and two new tables. No existing row changes.
--
--   workspace_settings.preset        'workshop' (default) or 'experiment'
--   workspace_consent_texts          the consent wording a guide writes, VERSIONED: a version is never edited, a change makes a new one
--   workspace_consents               one row per person per workspace: which version they agreed to, when, and when they withdrew
--
-- In an experiment a seat is only usable once its person has agreed to the current text; withdrawing stops new entries.
-- Hosts are keyed (host_type, host_id) as in 285/286. The code treats experiments as absent until these exist (fails soft).
--
-- NOT APPLIED by the worker who wrote it: the PM applies migrations.

ALTER TABLE workspace_settings ADD COLUMN IF NOT EXISTS preset VARCHAR(12) NOT NULL DEFAULT 'workshop';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_settings_preset_check') THEN
    ALTER TABLE workspace_settings ADD CONSTRAINT workspace_settings_preset_check CHECK (preset IN ('workshop', 'experiment'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS workspace_consent_texts (
  host_type   VARCHAR(16)  NOT NULL CHECK (host_type IN ('lms_run', 'thread')),
  host_id     TEXT         NOT NULL,
  version     INTEGER      NOT NULL CHECK (version >= 1),
  body        TEXT         NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  created_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (host_type, host_id, version)
);

CREATE TABLE IF NOT EXISTS workspace_consents (
  id            TEXT         PRIMARY KEY,
  host_type     VARCHAR(16)  NOT NULL CHECK (host_type IN ('lms_run', 'thread')),
  host_id       TEXT         NOT NULL,
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text_version  INTEGER      NOT NULL,
  given_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  withdrawn_at  TIMESTAMPTZ,
  UNIQUE (host_type, host_id, user_id),
  FOREIGN KEY (host_type, host_id, text_version) REFERENCES workspace_consent_texts (host_type, host_id, version)
);
CREATE INDEX IF NOT EXISTS idx_workspace_consents_host ON workspace_consents (host_type, host_id);
