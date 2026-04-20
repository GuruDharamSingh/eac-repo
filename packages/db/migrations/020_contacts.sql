-- Migration 020: contacts table
-- Stores visitors who expressed interest via a contact form.
-- These are leads/prospects, NOT authenticated users (no Supabase UUID required).
-- status lifecycle: new -> contacted -> joined

CREATE TABLE IF NOT EXISTS contacts (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  name        TEXT,
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'new'
                CHECK (status IN ('new', 'contacted', 'joined')),
  source      TEXT,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_org    ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(org_id, status);
CREATE INDEX IF NOT EXISTS idx_contacts_email  ON contacts(email);
