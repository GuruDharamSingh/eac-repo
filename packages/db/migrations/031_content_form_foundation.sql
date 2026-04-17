-- ============================================================================
-- Migration 031: Content Form Foundation
-- ============================================================================
-- Adds the supporting tables and columns for the unified content form:
--   - is_meeting flag (decoupled from scheduled_at)
--   - thread_revisions (kind-transition audit trail)
--   - thread_orgs (cross-org posting)
--   - thread_references (thread-to-thread links)
--   - CMS flags on organizations
--   - content_drafts (auto-save)
--   - workshop_details / workshop_sessions
--   - question_polls (in-thread polls)
--   - notifications, bookmarks, flags tables (schematized per mmd)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD is_meeting FLAG TO THREADS
-- ============================================================================
-- Decouples "this is a meeting" from "it has a date". A meeting with no date
-- yet is still a meeting ("TBD"). This is an intent flag.
ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS is_meeting BOOLEAN DEFAULT false;

-- Back-fill: any thread with kind meeting/workshop is a meeting
UPDATE threads SET is_meeting = true WHERE kind IN ('meeting', 'workshop') AND NOT is_meeting;

-- ============================================================================
-- 2. THREAD REVISIONS (kind transition audit trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS thread_revisions (
  id          VARCHAR(21)  PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  thread_id   VARCHAR(21)  NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  prior_kind  VARCHAR(20)  NOT NULL,
  snapshot    JSONB        NOT NULL,
  changed_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thread_revisions_thread
  ON thread_revisions(thread_id, created_at DESC);

-- ============================================================================
-- 3. THREAD ORGS (cross-org posting)
-- ============================================================================
CREATE TABLE IF NOT EXISTS thread_orgs (
  thread_id  VARCHAR(21)  NOT NULL REFERENCES threads(id)       ON DELETE CASCADE,
  org_id     VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  added_by   UUID         REFERENCES users(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ  DEFAULT NOW(),
  PRIMARY KEY (thread_id, org_id)
);

-- ============================================================================
-- 4. THREAD REFERENCES (thread-to-thread links)
-- ============================================================================
CREATE TABLE IF NOT EXISTS thread_references (
  id                   VARCHAR(21)  PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  thread_id            VARCHAR(21)  NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  references_thread_id VARCHAR(21)  NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (thread_id, references_thread_id)
);

-- ============================================================================
-- 5. CMS FLAGS ON ORGANIZATIONS
-- ============================================================================
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_cms          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_crosspost BOOLEAN DEFAULT false;

-- ============================================================================
-- 6. CONTENT DRAFTS (auto-save for the unified form)
-- ============================================================================
CREATE TABLE IF NOT EXISTS content_drafts (
  id            VARCHAR(21)  PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id        VARCHAR(50)  REFERENCES organizations(id) ON DELETE CASCADE,
  content_type  VARCHAR(20)  DEFAULT 'thread'
                  CHECK (content_type IN ('thread', 'reply', 'workshop')),
  title         TEXT,
  body          TEXT,
  meeting_data  JSONB,
  current_step  INTEGER      DEFAULT 1,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_drafts_user
  ON content_drafts(user_id, updated_at DESC);

-- ============================================================================
-- 7. WORKSHOP DETAILS (1:1 extension for kind='workshop')
-- ============================================================================
CREATE TABLE IF NOT EXISTS workshop_details (
  thread_id       VARCHAR(21)  PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
  materials       TEXT,
  pricing         JSONB,
  cover_image_url TEXT,
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================================
-- 8. WORKSHOP SESSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS workshop_sessions (
  id               VARCHAR(21)  PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  thread_id        VARCHAR(21)  NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  session_number   INTEGER      NOT NULL DEFAULT 1,
  topic            TEXT,
  scheduled_at     TIMESTAMPTZ,
  duration_minutes INTEGER,
  notes            JSONB,
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workshop_sessions_thread
  ON workshop_sessions(thread_id, session_number);

-- ============================================================================
-- 9. QUESTION POLLS (in-thread polls, distinct from availability polls)
-- ============================================================================
CREATE TABLE IF NOT EXISTS question_polls (
  id           VARCHAR(21)  PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  thread_id    VARCHAR(21)  REFERENCES threads(id) ON DELETE CASCADE,
  created_by   UUID         NOT NULL REFERENCES users(id),
  question     TEXT         NOT NULL,
  multi_select BOOLEAN      DEFAULT false,
  status       VARCHAR(20)  DEFAULT 'open'
                 CHECK (status IN ('open', 'closed')),
  total_votes  INTEGER      DEFAULT 0,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS question_poll_options (
  id         VARCHAR(21)  PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  poll_id    VARCHAR(21)  NOT NULL REFERENCES question_polls(id) ON DELETE CASCADE,
  label      TEXT         NOT NULL,
  vote_count INTEGER      DEFAULT 0,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS question_poll_votes (
  id         VARCHAR(21)  PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  poll_id    VARCHAR(21)  NOT NULL REFERENCES question_polls(id) ON DELETE CASCADE,
  option_id  VARCHAR(21)  NOT NULL REFERENCES question_poll_options(id) ON DELETE CASCADE,
  user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (poll_id, option_id, user_id)
);

-- ============================================================================
-- 10. NOTIFICATIONS TABLE (schematized per mmd diagram)
-- ============================================================================
-- Only create if not exists (migration 002 may have created a different shape)
CREATE TABLE IF NOT EXISTS notifications (
  id              VARCHAR(21)  PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            VARCHAR(50)  NOT NULL,
  thread_id       VARCHAR(21)  REFERENCES threads(id) ON DELETE CASCADE,
  reply_id        VARCHAR(21),
  actor_id        UUID         REFERENCES users(id) ON DELETE SET NULL,
  data            JSONB        DEFAULT '{}',
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;

-- ============================================================================
-- 11. BOOKMARKS (schematized per mmd diagram)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookmarks (
  id        VARCHAR(21)  PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  user_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id VARCHAR(21)  REFERENCES threads(id) ON DELETE CASCADE,
  reply_id  VARCHAR(21),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, thread_id)
);

-- ============================================================================
-- 12. FLAGS (content reports, schematized per mmd diagram)
-- ============================================================================
CREATE TABLE IF NOT EXISTS flags (
  id            VARCHAR(21)  PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  target_kind   VARCHAR(20)  NOT NULL,
  target_id     VARCHAR(21)  NOT NULL,
  reporter_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason        VARCHAR(50),
  status        VARCHAR(20)  DEFAULT 'pending'
                  CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  resolved_by   UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================================
-- 13. MODERATION LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS moderation_log (
  id            VARCHAR(21)  PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  moderator_id  UUID         NOT NULL REFERENCES users(id),
  action        VARCHAR(50)  NOT NULL,
  target_kind   VARCHAR(20)  NOT NULL,
  target_id     VARCHAR(21)  NOT NULL,
  reason        TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

COMMIT;
