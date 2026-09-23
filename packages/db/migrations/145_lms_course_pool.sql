-- ============================================================================
-- 145: Sophia — a course's POOL: the drafting table beside the outline.
--
-- While a course is being shaped, its author gathers what it might draw on:
-- threads from anywhere on the network (a standing meeting, an essay, a forum
-- topic), links from the open web, files already in the org's media, and
-- loose notes. The pool holds REFERENCES, never copies: a thread stays where
-- it lives, a URL stays a URL (with the title/description/image it had when
-- it was captured, so link rot is at least legible).
--
-- Pulling an item into a step writes into that step's draft `refs` (threadId,
-- links[], media[]) — the pool itself is never published and learners never
-- see it. "Used / unused" is derived by looking at the working outline's
-- drafts, not stored, so it cannot drift.
-- ============================================================================
CREATE TABLE IF NOT EXISTS lms_pool_items (
  id           TEXT         PRIMARY KEY,
  course_id    TEXT         NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
  org_id       VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind         VARCHAR(12)  NOT NULL CHECK (kind IN ('thread', 'url', 'media', 'note')),
  -- kind = thread. SET NULL keeps the row (with its captured title) if the thread goes.
  thread_id    TEXT         REFERENCES threads(id) ON DELETE SET NULL,
  -- kind = url | media
  url          TEXT,
  -- Captured at add time (OpenGraph for a url; the thread's own for a thread).
  title        TEXT         NOT NULL,
  description  TEXT,
  image_url    TEXT,
  site_name    TEXT,
  -- kind = media: audio | video | image | file
  media_kind   VARCHAR(8),
  -- The author's own words about why it is here.
  note         TEXT,
  tags         TEXT[]       NOT NULL DEFAULT '{}',
  added_by     UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  archived_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_lms_pool_course ON lms_pool_items (course_id, created_at DESC) WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_pool_thread ON lms_pool_items (course_id, thread_id) WHERE thread_id IS NOT NULL AND archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_pool_url ON lms_pool_items (course_id, url) WHERE url IS NOT NULL AND archived_at IS NULL;
