-- Migration 015: Event Pages + Recurrence Until
-- Adds recurrence_until to meetings and creates event_pages table

-- Add recurrence end date to meetings
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence_until TIMESTAMPTZ;

-- Event pages: opt-in rich detail pages for meetings
CREATE TABLE IF NOT EXISTS event_pages (
  id VARCHAR(21) PRIMARY KEY,
  meeting_id VARCHAR(21) UNIQUE NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  org_id VARCHAR(50) NOT NULL REFERENCES organizations(id),
  content JSONB NOT NULL DEFAULT '{}',
  colors JSONB DEFAULT '{}',
  table_data JSONB DEFAULT '[]',
  layout VARCHAR(20) DEFAULT 'default',
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_pages_meeting_id ON event_pages(meeting_id);
CREATE INDEX IF NOT EXISTS idx_event_pages_org_id ON event_pages(org_id);
CREATE INDEX IF NOT EXISTS idx_event_pages_is_published ON event_pages(is_published);

-- Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_event_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_event_pages_updated_at ON event_pages;
CREATE TRIGGER trigger_event_pages_updated_at
  BEFORE UPDATE ON event_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_event_pages_updated_at();
