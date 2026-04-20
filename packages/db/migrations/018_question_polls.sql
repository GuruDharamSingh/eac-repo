-- Migration 018: Question Polls
-- Date: 2026-02-16
-- Description: Add tables for question-based polls (single/multi choice)
--   distinct from availability_polls which handle time-slot scheduling

-- Question-based polls
CREATE TABLE IF NOT EXISTS question_polls (
  id VARCHAR(21) PRIMARY KEY,
  org_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id),
  question TEXT NOT NULL,
  description TEXT,
  poll_type VARCHAR(20) NOT NULL DEFAULT 'single_choice'
    CHECK (poll_type IN ('single_choice', 'multi_choice')),
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'cancelled')),
  show_results_before_vote BOOLEAN DEFAULT true,
  deadline TIMESTAMPTZ,
  vote_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Poll answer options
CREATE TABLE IF NOT EXISTS poll_options (
  id VARCHAR(21) PRIMARY KEY,
  poll_id VARCHAR(21) NOT NULL REFERENCES question_polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  vote_count INTEGER NOT NULL DEFAULT 0
);

-- Individual votes
CREATE TABLE IF NOT EXISTS poll_votes (
  id VARCHAR(21) PRIMARY KEY,
  poll_id VARCHAR(21) NOT NULL REFERENCES question_polls(id) ON DELETE CASCADE,
  option_id VARCHAR(21) NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One vote per option per user (for multi_choice, user can vote on multiple options)
CREATE UNIQUE INDEX IF NOT EXISTS idx_poll_votes_unique
  ON poll_votes(poll_id, option_id, user_id);

-- For single_choice: one vote per poll per user (enforced at application level)

-- Indexes
CREATE INDEX IF NOT EXISTS idx_question_polls_org ON question_polls(org_id);
CREATE INDEX IF NOT EXISTS idx_question_polls_status ON question_polls(status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_question_polls_creator ON question_polls(creator_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user ON poll_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON poll_votes(option_id);

-- Auto-update vote_count on poll_options
CREATE OR REPLACE FUNCTION update_poll_option_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE poll_options SET vote_count = vote_count + 1 WHERE id = NEW.option_id;
    UPDATE question_polls SET vote_count = vote_count + 1, updated_at = NOW() WHERE id = NEW.poll_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE poll_options SET vote_count = vote_count - 1 WHERE id = OLD.option_id;
    UPDATE question_polls SET vote_count = vote_count - 1, updated_at = NOW() WHERE id = OLD.poll_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_poll_vote_count ON poll_votes;
CREATE TRIGGER trigger_poll_vote_count
  AFTER INSERT OR DELETE ON poll_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_poll_option_vote_count();

-- Auto-update updated_at on question_polls
DROP TRIGGER IF EXISTS trigger_question_polls_updated_at ON question_polls;
CREATE TRIGGER trigger_question_polls_updated_at
  BEFORE UPDATE ON question_polls
  FOR EACH ROW
  EXECUTE FUNCTION update_availability_updated_at();

-- Comments
COMMENT ON TABLE question_polls IS 'Question-based polls with single or multiple choice options, publishable to the feed';
COMMENT ON TABLE poll_options IS 'Answer options for question polls';
COMMENT ON TABLE poll_votes IS 'Individual user votes on poll options';
COMMENT ON COLUMN question_polls.poll_type IS 'single_choice = one answer only, multi_choice = select multiple';
COMMENT ON COLUMN question_polls.vote_count IS 'Total number of individual votes cast (auto-updated via trigger)';
