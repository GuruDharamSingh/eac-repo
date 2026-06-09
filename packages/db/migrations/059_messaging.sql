-- ============================================================================
-- Migration 059: Internal messaging (cross-monorepo)
-- ============================================================================
-- A general user-to-user messaging system usable by any app in the monorepo.
-- A `conversation` is a thread between two or more users, optionally *about*
-- something (an artwork, an order, an org) via a generic (context_type,
-- context_id) pair so any app can scope threads to its own entities without a
-- schema change. Read state is tracked per participant.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS conversation (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  subject          TEXT,
  -- Optional context this thread is about, e.g. ('artwork', '<uuid>').
  context_type     TEXT,
  context_id       TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_message_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversation_last_message
  ON conversation(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_context
  ON conversation(context_type, context_id);

CREATE TABLE IF NOT EXISTS conversation_participant (
  conversation_id  UUID         NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  user_id          UUID         NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  last_read_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_participant_user
  ON conversation_participant(user_id);

CREATE TABLE IF NOT EXISTS message (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID         NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  sender_id        UUID         NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  body             TEXT         NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_message_conversation
  ON message(conversation_id, created_at);

COMMIT;
