-- ============================================================================
-- Migration 043: Reading Groups + Book Program Foundation
-- ============================================================================
-- Adds the domain tables for apps/fourth-way-book-readers. The shape keeps
-- reading groups org-backed, uses threads for meetings/discussion, and stores
-- source/resources in Nextcloud-backed media where applicable.
-- ============================================================================

BEGIN;

INSERT INTO organizations (id, name, slug, description, nextcloud_folder_path)
VALUES (
  'fourth_way_book_readers',
  '4th Way Book Readers',
  '4th-way-book-readers',
  'Reading circles for weekly book study, meetings, notes, and recaps.',
  'EAC-Network/fourth_way_book_readers'
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    nextcloud_folder_path = EXCLUDED.nextcloud_folder_path;

CREATE TABLE IF NOT EXISTS reading_groups (
  id                           VARCHAR(21) PRIMARY KEY,
  org_id                       VARCHAR(50) NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  name                         TEXT NOT NULL,
  slug                         TEXT NOT NULL UNIQUE,
  description                  TEXT,
  visibility                   VARCHAR(20) NOT NULL DEFAULT 'PUBLIC'
                                 CHECK (visibility IN ('PUBLIC', 'ORGANIZATION', 'INVITE_ONLY')),
  status                       VARCHAR(20) NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'paused', 'archived')),
  default_interval_days        INTEGER NOT NULL DEFAULT 7 CHECK (default_interval_days > 0),
  default_time_zone            TEXT DEFAULT 'America/Toronto',
  nextcloud_folder_path        TEXT,
  created_by                   UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata                     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reading_groups_org ON reading_groups(org_id);
CREATE INDEX IF NOT EXISTS idx_reading_groups_status ON reading_groups(status);

INSERT INTO reading_groups (
  id, org_id, name, slug, description, nextcloud_folder_path
)
VALUES (
  'rg_4th_way',
  'fourth_way_book_readers',
  'Fourth Way Book Readers',
  'fourth-way-book-readers',
  'A weekly reading table for Fourth Way texts and related study materials.',
  'EAC-Network/fourth_way_book_readers/Reading'
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    nextcloud_folder_path = EXCLUDED.nextcloud_folder_path,
    updated_at = NOW();

CREATE TABLE IF NOT EXISTS reading_books (
  id                    VARCHAR(21) PRIMARY KEY,
  org_id                VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  slug                  TEXT NOT NULL,
  author                TEXT,
  description           TEXT,
  language              TEXT DEFAULT 'en',
  source_type           VARCHAR(20) NOT NULL DEFAULT 'manual'
                          CHECK (source_type IN ('pdf', 'epub', 'audio', 'manual', 'link')),
  rights_status         VARCHAR(30) NOT NULL DEFAULT 'unknown'
                          CHECK (rights_status IN ('public_domain', 'licensed', 'member_private', 'link_only', 'unknown')),
  source_media_id       VARCHAR(21) REFERENCES media(id) ON DELETE SET NULL,
  source_url            TEXT,
  cover_media_id        VARCHAR(21) REFERENCES media(id) ON DELETE SET NULL,
  nextcloud_source_path TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_reading_books_org ON reading_books(org_id);
CREATE INDEX IF NOT EXISTS idx_reading_books_rights ON reading_books(rights_status);

CREATE TABLE IF NOT EXISTS reading_programs (
  id                    VARCHAR(21) PRIMARY KEY,
  org_id                VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  group_id              VARCHAR(21) NOT NULL REFERENCES reading_groups(id) ON DELETE CASCADE,
  book_id               VARCHAR(21) NOT NULL REFERENCES reading_books(id) ON DELETE CASCADE,
  thread_id             VARCHAR(21) REFERENCES threads(id) ON DELETE SET NULL,
  title                 TEXT NOT NULL,
  slug                  TEXT NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  visibility            VARCHAR(20) NOT NULL DEFAULT 'ORGANIZATION'
                          CHECK (visibility IN ('PUBLIC', 'ORGANIZATION', 'INVITE_ONLY')),
  starts_on             DATE,
  interval_days         INTEGER NOT NULL DEFAULT 7 CHECK (interval_days > 0),
  meeting_time          TIME,
  time_zone             TEXT DEFAULT 'America/Toronto',
  newsletter_enabled    BOOLEAN NOT NULL DEFAULT true,
  nextcloud_folder_path TEXT,
  created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_reading_programs_org ON reading_programs(org_id);
CREATE INDEX IF NOT EXISTS idx_reading_programs_group ON reading_programs(group_id);
CREATE INDEX IF NOT EXISTS idx_reading_programs_book ON reading_programs(book_id);
CREATE INDEX IF NOT EXISTS idx_reading_programs_status ON reading_programs(status);

CREATE TABLE IF NOT EXISTS reading_units (
  id                         VARCHAR(21) PRIMARY KEY,
  org_id                     VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  program_id                 VARCHAR(21) NOT NULL REFERENCES reading_programs(id) ON DELETE CASCADE,
  sequence                   INTEGER NOT NULL CHECK (sequence > 0),
  title                      TEXT NOT NULL,
  label                      TEXT,
  locator                    TEXT,
  starts_on                  DATE,
  meeting_thread_id          VARCHAR(21) REFERENCES threads(id) ON DELETE SET NULL,
  discussion_thread_id       VARCHAR(21) REFERENCES threads(id) ON DELETE SET NULL,
  notes_document_url         TEXT,
  notes_nextcloud_path       TEXT,
  newsletter_issue_id        VARCHAR(21),
  estimated_minutes          INTEGER,
  status                     VARCHAR(20) NOT NULL DEFAULT 'planned'
                               CHECK (status IN ('planned', 'open', 'completed', 'skipped')),
  metadata                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_reading_units_org ON reading_units(org_id);
CREATE INDEX IF NOT EXISTS idx_reading_units_program ON reading_units(program_id, sequence);
CREATE INDEX IF NOT EXISTS idx_reading_units_meeting ON reading_units(meeting_thread_id);

CREATE TABLE IF NOT EXISTS reading_resources (
  id                  VARCHAR(21) PRIMARY KEY,
  org_id              VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  unit_id             VARCHAR(21) NOT NULL REFERENCES reading_units(id) ON DELETE CASCADE,
  kind                VARCHAR(20) NOT NULL
                        CHECK (kind IN ('youtube', 'audio', 'pdf', 'link', 'document', 'note')),
  title               TEXT NOT NULL,
  url                 TEXT,
  media_id            VARCHAR(21) REFERENCES media(id) ON DELETE SET NULL,
  nextcloud_path      TEXT,
  display_order       INTEGER NOT NULL DEFAULT 0,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reading_resources_unit ON reading_resources(unit_id, display_order);
CREATE INDEX IF NOT EXISTS idx_reading_resources_org ON reading_resources(org_id);

CREATE TABLE IF NOT EXISTS reading_note_snapshots (
  id                         VARCHAR(21) PRIMARY KEY,
  org_id                     VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  unit_id                    VARCHAR(21) NOT NULL REFERENCES reading_units(id) ON DELETE CASCADE,
  source_document_url        TEXT,
  source_nextcloud_path      TEXT,
  body                       TEXT NOT NULL DEFAULT '',
  highlights                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  captured_by                UUID REFERENCES users(id) ON DELETE SET NULL,
  captured_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata                   JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_reading_note_snapshots_unit ON reading_note_snapshots(unit_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_note_snapshots_org ON reading_note_snapshots(org_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS reading_newsletter_issues (
  id                         VARCHAR(21) PRIMARY KEY,
  org_id                     VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  program_id                 VARCHAR(21) NOT NULL REFERENCES reading_programs(id) ON DELETE CASCADE,
  unit_id                    VARCHAR(21) REFERENCES reading_units(id) ON DELETE SET NULL,
  source_snapshot_id         VARCHAR(21) REFERENCES reading_note_snapshots(id) ON DELETE SET NULL,
  title                      TEXT NOT NULL,
  subject                    TEXT NOT NULL,
  body_text                  TEXT,
  body_html                  TEXT,
  status                     VARCHAR(20) NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'review', 'scheduled', 'sent', 'archived')),
  scheduled_for              TIMESTAMPTZ,
  sent_at                    TIMESTAMPTZ,
  created_by                 UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reading_newsletter_program ON reading_newsletter_issues(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_newsletter_org ON reading_newsletter_issues(org_id, status);

ALTER TABLE reading_units
  ADD CONSTRAINT reading_units_newsletter_issue_fk
  FOREIGN KEY (newsletter_issue_id) REFERENCES reading_newsletter_issues(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION update_reading_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reading_groups_updated_at ON reading_groups;
CREATE TRIGGER trigger_reading_groups_updated_at
  BEFORE UPDATE ON reading_groups
  FOR EACH ROW EXECUTE FUNCTION update_reading_updated_at();

DROP TRIGGER IF EXISTS trigger_reading_books_updated_at ON reading_books;
CREATE TRIGGER trigger_reading_books_updated_at
  BEFORE UPDATE ON reading_books
  FOR EACH ROW EXECUTE FUNCTION update_reading_updated_at();

DROP TRIGGER IF EXISTS trigger_reading_programs_updated_at ON reading_programs;
CREATE TRIGGER trigger_reading_programs_updated_at
  BEFORE UPDATE ON reading_programs
  FOR EACH ROW EXECUTE FUNCTION update_reading_updated_at();

DROP TRIGGER IF EXISTS trigger_reading_units_updated_at ON reading_units;
CREATE TRIGGER trigger_reading_units_updated_at
  BEFORE UPDATE ON reading_units
  FOR EACH ROW EXECUTE FUNCTION update_reading_updated_at();

DROP TRIGGER IF EXISTS trigger_reading_newsletter_updated_at ON reading_newsletter_issues;
CREATE TRIGGER trigger_reading_newsletter_updated_at
  BEFORE UPDATE ON reading_newsletter_issues
  FOR EACH ROW EXECUTE FUNCTION update_reading_updated_at();

COMMIT;