-- ============================================================================
-- Migration 030: Unified Threads Schema
-- ============================================================================
-- Consolidates posts + meetings into a single `threads` table with a `kind`
-- discriminator (post, meeting, workshop).  This is the "everything is a
-- thread" refactor – the Substack/Twitter pattern.
--
-- Also renames join tables (post_topics, meeting_topics, meeting_attendees)
-- to thread_topics / thread_rsvps and updates the replies / media / reactions
-- polymorphic references.
--
-- ONE-WAY DOOR: drops posts, meetings, and related tables at the end.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE THE UNIFIED THREADS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS threads (
  id                      VARCHAR(21)  PRIMARY KEY,
  org_id                  VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id               UUID         NOT NULL REFERENCES users(id),
  kind                    VARCHAR(20)  NOT NULL DEFAULT 'post'
                            CHECK (kind IN ('post', 'meeting', 'workshop', 'event')),

  -- Content
  title                   TEXT         NOT NULL,
  slug                    VARCHAR(255) NOT NULL,
  body                    TEXT,
  excerpt                 TEXT,

  -- Status & visibility
  status                  VARCHAR(20)  DEFAULT 'draft'
                            CHECK (status IN ('draft', 'published', 'archived', 'scheduled')),
  visibility              VARCHAR(20)  DEFAULT 'PUBLIC'
                            CHECK (visibility IN ('PUBLIC', 'ORGANIZATION', 'INVITE_ONLY')),
  share_to_network        BOOLEAN      DEFAULT false,

  -- Forum features (from migration 003)
  pinned                  BOOLEAN      DEFAULT false,
  locked                  BOOLEAN      DEFAULT false,
  last_activity_at        TIMESTAMPTZ  DEFAULT NOW(),

  -- Section (amrit-canada)
  section                 VARCHAR(30)  CHECK (section IN ('amrit_vela', 'yoga', 'gurdwara')),

  -- Meeting / workshop fields (NULL for kind='post')
  scheduled_at            TIMESTAMPTZ,
  time_zone               VARCHAR(100),
  duration_minutes        INTEGER,
  location                TEXT,
  is_online               BOOLEAN      DEFAULT true,
  meeting_url             TEXT,
  is_rsvp_enabled         BOOLEAN      DEFAULT false,
  rsvp_deadline           TIMESTAMPTZ,
  attendee_limit          INTEGER,
  recurrence_pattern      VARCHAR(20)
                            CHECK (recurrence_pattern IN ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM')),
  recurrence_custom_rule  TEXT,
  recurrence_until        TIMESTAMPTZ,
  min_attendees           INTEGER      DEFAULT 0,
  notify_on_min_attendees BOOLEAN      DEFAULT false,
  min_attendees_notified  BOOLEAN      DEFAULT false,

  -- Video / recording
  video_url               TEXT,
  video_link              TEXT,
  auto_record             BOOLEAN      DEFAULT false,
  follow_up_workflow      BOOLEAN      DEFAULT false,
  show_in_live_feed       BOOLEAN      DEFAULT false,

  -- Co-hosts & tags
  co_host_ids             JSONB        DEFAULT '[]',
  tags                    JSONB        DEFAULT '[]',
  attachments             JSONB        DEFAULT '[]',
  reminder_minutes_before INTEGER,

  -- Nextcloud integration
  nextcloud_file_id       VARCHAR(255),
  nextcloud_talk_token    VARCHAR(255),
  nextcloud_recording_id  VARCHAR(255),
  nextcloud_calendar_event_id VARCHAR(255),
  nextcloud_calendar_synced   BOOLEAN  DEFAULT false,
  nextcloud_poll_id       VARCHAR(255),
  nextcloud_poll_synced   BOOLEAN      DEFAULT false,
  nextcloud_last_sync     TIMESTAMPTZ,
  document_url            TEXT,

  -- Workshop showcase (from migration 022)
  show_on_workshops_page  BOOLEAN      DEFAULT false,
  workshop_order          INTEGER,
  subtitle                VARCHAR(255),
  card_colour             VARCHAR(7),
  card_accent_colour      VARCHAR(7),

  -- Event pages
  drawing                 JSONB,

  -- Metadata & counters
  metadata                JSONB        DEFAULT '{}',
  view_count              INTEGER      DEFAULT 0,
  reply_count             INTEGER      DEFAULT 0,
  reaction_count          INTEGER      DEFAULT 0,

  -- Timestamps
  created_at              TIMESTAMPTZ  DEFAULT NOW(),
  published_at            TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ  DEFAULT NOW(),

  UNIQUE(org_id, slug)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_threads_org          ON threads(org_id);
CREATE INDEX IF NOT EXISTS idx_threads_author       ON threads(author_id);
CREATE INDEX IF NOT EXISTS idx_threads_kind         ON threads(kind);
CREATE INDEX IF NOT EXISTS idx_threads_status       ON threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_published    ON threads(published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_threads_scheduled    ON threads(scheduled_at)      WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_threads_section      ON threads(org_id, section, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_threads_pinned       ON threads(org_id, pinned, last_activity_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_threads_last_activity ON threads(last_activity_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_threads_workshop     ON threads(show_on_workshops_page, workshop_order) WHERE show_on_workshops_page = true;
CREATE INDEX IF NOT EXISTS idx_threads_live_feed    ON threads(org_id, show_in_live_feed) WHERE show_in_live_feed = true;

-- ============================================================================
-- 2. MIGRATE DATA FROM posts → threads
-- ============================================================================
INSERT INTO threads (
  id, org_id, author_id, kind,
  title, slug, body, excerpt,
  status, visibility,
  pinned, locked, last_activity_at,
  nextcloud_file_id, nextcloud_talk_token, document_url,
  nextcloud_last_sync,
  metadata, view_count, reply_count, reaction_count,
  created_at, published_at, updated_at
)
SELECT
  p.id, p.org_id, p.author_id, 'post',
  p.title, p.slug, p.body, p.excerpt,
  p.status, p.visibility,
  COALESCE(p.is_pinned, false),
  COALESCE(p.is_locked, false),
  COALESCE(p.last_activity_at, p.created_at),
  p.nextcloud_file_id, p.nextcloud_talk_token, p.document_url,
  p.nextcloud_last_sync,
  COALESCE(p.metadata, '{}'), COALESCE(p.view_count, 0),
  COALESCE(p.reply_count, 0), COALESCE(p.reaction_count, 0),
  p.created_at, p.published_at, p.updated_at
FROM posts p
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. MIGRATE DATA FROM meetings → threads
-- ============================================================================
INSERT INTO threads (
  id, org_id, author_id, kind,
  title, slug, body,
  status, visibility,
  pinned, locked, last_activity_at,
  scheduled_at, time_zone, duration_minutes,
  location, is_online, meeting_url,
  is_rsvp_enabled, rsvp_deadline, attendee_limit,
  recurrence_pattern, recurrence_custom_rule, recurrence_until,
  min_attendees, notify_on_min_attendees, min_attendees_notified,
  video_url, video_link, auto_record, follow_up_workflow,
  co_host_ids, tags, attachments, reminder_minutes_before,
  nextcloud_file_id, nextcloud_talk_token, nextcloud_recording_id,
  nextcloud_calendar_event_id, nextcloud_calendar_synced,
  nextcloud_last_sync,
  metadata, view_count, reply_count, reaction_count,
  created_at, published_at, updated_at
)
SELECT
  m.id, m.org_id, m.guide_id, 'meeting',
  m.title, m.slug, m.description,
  m.status, m.visibility,
  COALESCE(m.is_pinned, false),
  COALESCE(m.is_locked, false),
  COALESCE(m.last_activity_at, m.created_at),
  m.scheduled_at, m.time_zone, m.duration_minutes,
  m.location, m.is_online, m.meeting_url,
  m.is_rsvp_enabled, m.rsvp_deadline, m.attendee_limit,
  m.recurrence_pattern, m.recurrence_custom_rule, m.recurrence_until,
  COALESCE(m.min_attendees, 0),
  COALESCE(m.notify_on_min_attendees, false),
  COALESCE(m.min_attendees_notified, false),
  m.video_url, m.video_link, m.auto_record, m.follow_up_workflow,
  COALESCE(m.co_host_ids, '[]'), COALESCE(m.tags, '[]'),
  COALESCE(m.attachments, '[]'), m.reminder_minutes_before,
  m.nextcloud_file_id, m.nextcloud_talk_token, m.nextcloud_recording_id,
  m.nextcloud_calendar_event_id, m.nextcloud_calendar_synced,
  m.nextcloud_last_sync,
  COALESCE(m.metadata, '{}'), COALESCE(m.view_count, 0),
  COALESCE(m.reply_count, 0), COALESCE(m.reaction_count, 0),
  m.created_at, m.published_at, m.updated_at
FROM meetings m
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. MIGRATE JOIN TABLES → thread_topics
-- ============================================================================
CREATE TABLE IF NOT EXISTS thread_topics (
  thread_id VARCHAR(21) REFERENCES threads(id) ON DELETE CASCADE,
  topic_id  VARCHAR(21) REFERENCES topics(id)  ON DELETE CASCADE,
  PRIMARY KEY (thread_id, topic_id)
);

INSERT INTO thread_topics (thread_id, topic_id)
SELECT post_id, topic_id FROM post_topics
ON CONFLICT DO NOTHING;

INSERT INTO thread_topics (thread_id, topic_id)
SELECT meeting_id, topic_id FROM meeting_topics
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. MIGRATE meeting_attendees → thread_rsvps
-- ============================================================================
CREATE TABLE IF NOT EXISTS thread_rsvps (
  thread_id     VARCHAR(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  status        VARCHAR(20) DEFAULT 'yes'
                  CHECK (status IN ('yes', 'no', 'maybe')),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_thread_rsvps_thread ON thread_rsvps(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_rsvps_user   ON thread_rsvps(user_id);

INSERT INTO thread_rsvps (thread_id, user_id, status, registered_at)
SELECT
  meeting_id, user_id,
  CASE attendance_status
    WHEN 'registered' THEN 'yes'
    WHEN 'attended'   THEN 'yes'
    WHEN 'absent'     THEN 'no'
    ELSE 'yes'
  END,
  registered_at
FROM meeting_attendees
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. CREATE guest_submissions TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS guest_submissions (
  id              VARCHAR(21) PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  thread_id       VARCHAR(21) REFERENCES threads(id) ON DELETE CASCADE,
  kind            VARCHAR(20) DEFAULT 'rsvp'
                    CHECK (kind IN ('rsvp', 'question', 'contact')),
  name            TEXT,
  email           VARCHAR(255),
  phone           TEXT,
  message         TEXT,
  wants_reminder  BOOLEAN     DEFAULT false,
  linked_user_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_submissions_thread ON guest_submissions(thread_id);

-- ============================================================================
-- 7. UPDATE replies polymorphic parent_type
-- ============================================================================
-- The replies table uses parent_type IN ('post', 'meeting', 'reply').
-- Now parent_type should reference 'thread' instead, but the code still uses
-- the old values. We'll update the CHECK constraint and remap.

ALTER TABLE replies DROP CONSTRAINT IF EXISTS replies_parent_type_check;
ALTER TABLE replies ADD CONSTRAINT replies_parent_type_check
  CHECK (parent_type IN ('post', 'meeting', 'reply', 'thread'));

-- Add session_id for workshop session replies
ALTER TABLE replies ADD COLUMN IF NOT EXISTS session_id VARCHAR(21);

-- ============================================================================
-- 8. UPDATE media polymorphic attached_to_type
-- ============================================================================
ALTER TABLE media DROP CONSTRAINT IF EXISTS media_attached_to_type_check;
ALTER TABLE media ADD CONSTRAINT media_attached_to_type_check
  CHECK (attached_to_type IN ('meeting', 'post', 'thread'));

-- ============================================================================
-- 9. UPDATE reactions polymorphic reactable_type
-- ============================================================================
ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_reactable_type_check;
ALTER TABLE reactions ADD CONSTRAINT reactions_reactable_type_check
  CHECK (reactable_type IN ('post', 'meeting', 'reply', 'thread'));

-- ============================================================================
-- 10. UPDATE watches polymorphic watchable_type
-- ============================================================================
ALTER TABLE watches DROP CONSTRAINT IF EXISTS watches_watchable_type_check;
ALTER TABLE watches ADD CONSTRAINT watches_watchable_type_check
  CHECK (watchable_type IN ('post', 'meeting', 'thread'));

-- ============================================================================
-- 11. DROP OLD TABLES
-- ============================================================================
-- Order matters due to FK constraints.
DROP TABLE IF EXISTS meeting_attendees CASCADE;
DROP TABLE IF EXISTS meeting_topics    CASCADE;
DROP TABLE IF EXISTS post_topics       CASCADE;
DROP TABLE IF EXISTS meetings          CASCADE;
DROP TABLE IF EXISTS posts             CASCADE;

COMMIT;
