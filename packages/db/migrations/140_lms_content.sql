-- ============================================================================
-- 140: Sophia (the LMS) — CONTENT layer. What is taught: authored, versioned,
-- immutable once published. See lms/SYNTHESIS.md for the whole design.
--
-- Three layers, one migration each, dependencies one way only:
--   record (142) → delivery (141) → content (140).
--
-- Versioning in one paragraph: authors edit MUTABLE drafts (lms_step_drafts,
-- lms_courses.draft_outline). Publishing is one transaction that freezes every
-- changed step into an immutable lms_step_versions row and the whole course
-- into an immutable lms_course_versions row whose `outline` names the exact
-- step versions. Runs (141) pin a course version, so an edit never changes a
-- lesson under someone who is part-way through it. Published versions are
-- never deleted. Progress (142) points at the STABLE lms_steps.id and records
-- which version was completed.
--
-- Step `type` is open text on purpose — types are a registry in
-- @elkdonis/lms, not an enum here; an unknown type renders a placeholder.
-- ============================================================================

CREATE TABLE IF NOT EXISTS lms_courses (
  id                    TEXT         PRIMARY KEY,
  org_id                VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Global, not per-org: the public URL is /<slug> on one canonical host.
  slug                  VARCHAR(120) NOT NULL UNIQUE,
  title                 TEXT         NOT NULL,
  -- ~150 characters; the meta description and the catalogue line.
  summary               TEXT,
  description_html      TEXT,
  cover_url             TEXT,
  language              VARCHAR(12)  NOT NULL DEFAULT 'en',
  -- public: listed + indexable. unlisted: reachable by link, noindex.
  -- private: staff and the enrolled only.
  visibility            VARCHAR(12)  NOT NULL DEFAULT 'private'
                          CHECK (visibility IN ('public', 'unlisted', 'private')),
  -- Mutable working outline: {modules:[{id,title,summary,steps:[{stepId,required,unlock}]}]}
  draft_outline         JSONB        NOT NULL DEFAULT '{"modules":[]}'::jsonb,
  published_version_id  TEXT,
  created_by            UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  archived_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_lms_courses_org ON lms_courses (org_id);

CREATE TABLE IF NOT EXISTS lms_steps (
  id           TEXT         PRIMARY KEY,
  course_id    TEXT         NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
  type         VARCHAR(40)  NOT NULL,
  -- Version-independent URL segment. Renames go through lms_slug_redirects.
  slug         VARCHAR(120) NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  archived_at  TIMESTAMPTZ,
  UNIQUE (course_id, slug)
);

-- The author's working copy of a step. One row per step, freely edited.
CREATE TABLE IF NOT EXISTS lms_step_drafts (
  step_id     TEXT         PRIMARY KEY REFERENCES lms_steps(id) ON DELETE CASCADE,
  title       TEXT         NOT NULL,
  -- Required at publish: every public step page stands alone for search.
  summary     TEXT,
  body_html   TEXT,
  -- Type-specific: prompt, minutes, alternative practice, transcript, …
  settings    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  -- Things the step POINTS AT and does not own: {threadId, questionnaireId,
  -- media:[{kind,url,title,transcript}]}.
  refs        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  updated_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Immutable. A row is written only by publish, and only when content changed.
CREATE TABLE IF NOT EXISTS lms_step_versions (
  id            TEXT         PRIMARY KEY,
  step_id       TEXT         NOT NULL REFERENCES lms_steps(id) ON DELETE CASCADE,
  version_no    INTEGER      NOT NULL,
  title         TEXT         NOT NULL,
  summary       TEXT,
  body_html     TEXT,
  settings      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  refs          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  -- Tag-free text of the step: search, export, and the AI seam (unused).
  plain_text    TEXT,
  content_hash  VARCHAR(64)  NOT NULL,
  created_by    UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (step_id, version_no)
);
CREATE INDEX IF NOT EXISTS idx_lms_step_versions_step ON lms_step_versions (step_id, version_no DESC);

-- Immutable snapshot of a whole course at publish.
CREATE TABLE IF NOT EXISTS lms_course_versions (
  id                TEXT         PRIMARY KEY,
  course_id         TEXT         NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
  version_no        INTEGER      NOT NULL,
  title             TEXT         NOT NULL,
  summary           TEXT,
  description_html  TEXT,
  -- {modules:[{id,title,summary,steps:[{stepId,stepVersionId,required,unlock}]}]}
  outline           JSONB        NOT NULL,
  -- 'fix' = wording only, same steps in the same order: runs may fast-forward.
  -- 'structural' = steps added/removed/reordered/rules changed: runs adopt explicitly.
  change_kind       VARCHAR(12)  NOT NULL DEFAULT 'structural'
                      CHECK (change_kind IN ('fix', 'structural')),
  notes             TEXT,
  published_by      UUID         REFERENCES users(id) ON DELETE SET NULL,
  published_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, version_no)
);

ALTER TABLE lms_courses DROP CONSTRAINT IF EXISTS lms_courses_published_version_fkey;
ALTER TABLE lms_courses
  ADD CONSTRAINT lms_courses_published_version_fkey
  FOREIGN KEY (published_version_id) REFERENCES lms_course_versions(id) ON DELETE SET NULL;

-- Old URLs keep working: a renamed course or step slug answers with a 301.
CREATE TABLE IF NOT EXISTS lms_slug_redirects (
  old_slug    VARCHAR(120) NOT NULL,
  course_id   TEXT         NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
  -- NULL = the course itself was renamed; else the step within course_id.
  step_id     TEXT         REFERENCES lms_steps(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_slug_redirects
  ON lms_slug_redirects (old_slug, course_id, COALESCE(step_id, ''));

-- Who may edit a course. Org owners/guides may too (checked in services);
-- this is for an author who holds no org role.
CREATE TABLE IF NOT EXISTS lms_course_staff (
  course_id   TEXT  NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
  user_id     UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL DEFAULT 'author' CHECK (role IN ('author')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_id, user_id)
);

-- The DEFINITION of something that can be earned. Awards are in 142.
-- Shaped so an Open Badges 3.0 Achievement can be generated from it later.
CREATE TABLE IF NOT EXISTS lms_achievements (
  id           TEXT         PRIMARY KEY,
  org_id       VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  course_id    TEXT         REFERENCES lms_courses(id) ON DELETE CASCADE,
  name         TEXT         NOT NULL,
  description  TEXT,
  -- {kind:'course_completed'} today; open for more.
  criteria     JSONB        NOT NULL DEFAULT '{"kind":"course_completed"}'::jsonb,
  image_url    TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
