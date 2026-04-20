-- Migration 023: Drift capture
--
-- Captures out-of-band schema additions that exist in the live elkdonis_dev
-- database but were never recorded in a migration file. Purely ADDITIVE —
-- no drops or renames. The goal is to make a fresh bootstrap
-- (setupDatabase() + migration runner) produce the same schema as the live
-- database so source-of-truth is consistent before migration 030 (unified
-- threads refactor).
--
-- Cleanup of unused columns, the orphan get_current_user_id() function, and
-- the polymorphic replies table is deferred to 030, which rewrites all of
-- this anyway.
--
-- Verified 2026-04-11 against live DB:
--   posts.document_url              (TEXT, 1 NOT NULL row; used by
--                                   inner-gathering createPost)
--   posts.nextcloud_talk_token      (VARCHAR(255); used by createPost
--                                   Talk-room flow)
--   meetings.meeting_type           (VARCHAR with CHECK constraint;
--                                   discriminator that will map to
--                                   threads.kind in 030)
--   meetings.min_attendees          (INTEGER, 9 rows populated; RSVP
--                                   threshold feature)
--   meetings.notify_on_min_attendees  (BOOLEAN DEFAULT false)
--   meetings.min_attendees_notified   (BOOLEAN DEFAULT false)
--   content_drafts table            (auto-save wizard state, used by
--                                   apps/inner-gathering/src/lib/draft-actions.ts)
--
-- The migration runner wraps every file in a transaction, so this file
-- contains no explicit BEGIN/COMMIT.

-- posts: document URL + Nextcloud Talk token
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS document_url         TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nextcloud_talk_token VARCHAR(255) DEFAULT NULL;

-- meetings: meeting_type discriminator
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS meeting_type VARCHAR(20) DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meetings_meeting_type_check'
  ) THEN
    ALTER TABLE meetings
      ADD CONSTRAINT meetings_meeting_type_check
      CHECK (
        meeting_type IS NULL
        OR meeting_type IN ('sitting', 'theatrical', 'discussion', 'other')
      );
  END IF;
END $$;

-- meetings: minimum-attendee RSVP threshold + notification flags
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS min_attendees           INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notify_on_min_attendees BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_attendees_notified  BOOLEAN DEFAULT false;

-- content_drafts: auto-save drafts for meeting/post creation wizards
-- Referenced by apps/inner-gathering/src/lib/draft-actions.ts
CREATE TABLE IF NOT EXISTS content_drafts (
  id                   VARCHAR(21) PRIMARY KEY,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id               VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  content_type         VARCHAR(20) NOT NULL
                         CHECK (content_type IN ('post', 'meeting')),
  title                TEXT         DEFAULT '',
  slug                 VARCHAR(255) DEFAULT '',
  body                 TEXT         DEFAULT '',
  excerpt              TEXT         DEFAULT '',
  visibility           VARCHAR(20)  DEFAULT 'PUBLIC',
  meeting_data         JSONB        DEFAULT '{}'::jsonb,
  media_refs           JSONB        DEFAULT '[]'::jsonb,
  integration_settings JSONB        DEFAULT '{}'::jsonb,
  current_step         INTEGER      DEFAULT 0,
  created_at           TIMESTAMPTZ  DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drafts_user    ON content_drafts (user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_updated ON content_drafts (updated_at DESC);
