-- Store editable email template settings per organization.
-- The React Email component remains the renderer; this table stores copy,
-- extra links, and media payloads used by the renderer at send time.

CREATE TABLE IF NOT EXISTS email_template_settings (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  template_key  TEXT NOT NULL,
  config        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by    TEXT,
  updated_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_email_template_settings_org
  ON email_template_settings (org_id);

CREATE INDEX IF NOT EXISTS idx_email_template_settings_template
  ON email_template_settings (template_key);
