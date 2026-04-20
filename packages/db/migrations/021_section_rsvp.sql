-- Migration 021: Add section to meetings + guest rsvp_responses table

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS section VARCHAR(30)
  CHECK (section IN ('amrit_vela', 'yoga', 'gurdwara'));

CREATE INDEX IF NOT EXISTS idx_meetings_section ON meetings(org_id, section, scheduled_at);

CREATE TABLE IF NOT EXISTS rsvp_responses (
  id TEXT PRIMARY KEY,
  meeting_id VARCHAR(21) NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  org_id VARCHAR(50) NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  message TEXT,
  wants_reminder BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rsvp_meeting ON rsvp_responses(meeting_id);
CREATE INDEX IF NOT EXISTS idx_rsvp_org ON rsvp_responses(org_id, created_at DESC);
