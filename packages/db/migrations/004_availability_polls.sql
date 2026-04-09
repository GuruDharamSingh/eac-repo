-- Migration 004: Availability Polls
-- Date: 2024-10-26
-- Description: Add tables for availability polling with timezone support

-- Availability Polls
CREATE TABLE IF NOT EXISTS availability_polls (
  id VARCHAR(21) PRIMARY KEY,
  org_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,

  -- Date/time range for poll
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  earliest_time TIME NOT NULL,     -- e.g., 09:00
  latest_time TIME NOT NULL,        -- e.g., 21:00
  time_slot_duration INTEGER NOT NULL DEFAULT 30,  -- minutes

  -- Nextcloud integration
  nextcloud_poll_id VARCHAR(255),
  nextcloud_calendar_proposal_id VARCHAR(255),

  -- Status
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'locked', 'cancelled')),
  locked_time_slot TIMESTAMPTZ,    -- Final chosen time
  final_meeting_id VARCHAR(21) REFERENCES meetings(id),

  -- Settings
  allow_maybe BOOLEAN DEFAULT true,
  require_authentication BOOLEAN DEFAULT true,
  show_participants BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deadline TIMESTAMPTZ,

  -- Counters
  response_count INTEGER DEFAULT 0
);

-- Individual availability responses
CREATE TABLE IF NOT EXISTS availability_responses (
  id VARCHAR(21) PRIMARY KEY,
  poll_id VARCHAR(21) NOT NULL REFERENCES availability_polls(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),  -- NULL if anonymous allowed
  user_name VARCHAR(255),             -- For display (or anonymous responses)
  user_email VARCHAR(255),            -- For notifications

  -- Timezone handling
  user_timezone VARCHAR(100) NOT NULL, -- e.g., 'America/New_York'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure one response per user per poll
CREATE UNIQUE INDEX IF NOT EXISTS idx_responses_unique_user
  ON availability_responses(poll_id, user_id)
  WHERE user_id IS NOT NULL;

-- Time slot selections (YES/NO/MAYBE)
CREATE TABLE IF NOT EXISTS availability_slots (
  response_id VARCHAR(21) NOT NULL REFERENCES availability_responses(id) ON DELETE CASCADE,
  time_slot TIMESTAMPTZ NOT NULL,
  availability VARCHAR(10) NOT NULL CHECK (availability IN ('yes', 'no', 'maybe')),

  PRIMARY KEY (response_id, time_slot)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_polls_org ON availability_polls(org_id);
CREATE INDEX IF NOT EXISTS idx_polls_creator ON availability_polls(creator_id);
CREATE INDEX IF NOT EXISTS idx_polls_status ON availability_polls(status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_polls_dates ON availability_polls(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_responses_poll ON availability_responses(poll_id);
CREATE INDEX IF NOT EXISTS idx_responses_user ON availability_responses(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_slots_response ON availability_slots(response_id);
CREATE INDEX IF NOT EXISTS idx_slots_time ON availability_slots(time_slot);

-- Function to update response count
CREATE OR REPLACE FUNCTION update_poll_response_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE availability_polls
    SET response_count = response_count + 1,
        updated_at = NOW()
    WHERE id = NEW.poll_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE availability_polls
    SET response_count = response_count - 1,
        updated_at = NOW()
    WHERE id = OLD.poll_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain response count
DROP TRIGGER IF EXISTS trigger_update_poll_response_count ON availability_responses;
CREATE TRIGGER trigger_update_poll_response_count
  AFTER INSERT OR DELETE ON availability_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_poll_response_count();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_availability_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_polls_updated_at ON availability_polls;
CREATE TRIGGER trigger_polls_updated_at
  BEFORE UPDATE ON availability_polls
  FOR EACH ROW
  EXECUTE FUNCTION update_availability_updated_at();

DROP TRIGGER IF EXISTS trigger_responses_updated_at ON availability_responses;
CREATE TRIGGER trigger_responses_updated_at
  BEFORE UPDATE ON availability_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_availability_updated_at();

-- Comments for documentation
COMMENT ON TABLE availability_polls IS 'Polls for scheduling meetings by collecting availability from multiple participants';
COMMENT ON TABLE availability_responses IS 'Individual participant responses to availability polls';
COMMENT ON TABLE availability_slots IS 'Specific time slot availability (yes/no/maybe) for each response';

COMMENT ON COLUMN availability_polls.time_slot_duration IS 'Duration of each time slot in minutes (e.g., 30 for 30-minute slots)';
COMMENT ON COLUMN availability_polls.locked_time_slot IS 'When status=locked, this is the final chosen time';
COMMENT ON COLUMN availability_responses.user_timezone IS 'IANA timezone identifier (e.g., America/New_York, Europe/London)';
COMMENT ON COLUMN availability_slots.availability IS 'yes = available, no = not available, maybe = tentatively available';
