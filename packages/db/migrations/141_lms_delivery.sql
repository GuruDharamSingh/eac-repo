-- ============================================================================
-- 141: Sophia — DELIVERY layer. A course for particular people at a
-- particular time: runs, staff, entitlements, enrolments.
--
-- Every course has a DEFAULT run (mode 'open', always enrolling). Cohorts and
-- circles are additional runs. All enrolments belong to a run — there is one
-- enrolment model, not two.
--
-- A cohort run can BE a workshop thread (workshop_thread_id): RSVP, capacity,
-- reminders, the Talk room, the calendar and the gated materials folder are
-- reused from the workshop machinery rather than rebuilt here.
--
-- Entitlement (the right to take a course) is separate from enrolment (a seat
-- in a run). A public free course grants 'free' on the spot; 'order' is the
-- seam for payments.
-- ============================================================================

CREATE TABLE IF NOT EXISTS lms_runs (
  id                   TEXT         PRIMARY KEY,
  course_id            TEXT         NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
  org_id               VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug                 VARCHAR(120) NOT NULL,
  title                TEXT         NOT NULL,
  -- open: self-paced, quiet practice companion.  drip: open + offsets.
  -- cohort: dated, guided, community classroom.  circle: peer-led, no guide.
  mode                 VARCHAR(12)  NOT NULL DEFAULT 'open'
                         CHECK (mode IN ('open', 'drip', 'cohort', 'circle')),
  course_version_id    TEXT         NOT NULL REFERENCES lms_course_versions(id),
  -- Follow 'fix' publishes automatically. Structural ones always need adopting.
  auto_fast_forward    BOOLEAN      NOT NULL DEFAULT TRUE,
  is_default           BOOLEAN      NOT NULL DEFAULT FALSE,
  status               VARCHAR(12)  NOT NULL DEFAULT 'open'
                         CHECK (status IN ('draft', 'open', 'closed', 'archived')),
  starts_at            TIMESTAMPTZ,
  ends_at              TIMESTAMPTZ,
  capacity             INTEGER,
  -- open: anyone entitled may take a seat. invite: staff add people.
  enrol_policy         VARCHAR(12)  NOT NULL DEFAULT 'open'
                         CHECK (enrol_policy IN ('open', 'invite')),
  -- What a new reflection defaults to in this run. The learner can always
  -- choose per entry; this is only the starting position of the control.
  default_visibility   VARCHAR(12)  NOT NULL DEFAULT 'me'
                         CHECK (default_visibility IN ('me', 'guide', 'circle')),
  workshop_thread_id   TEXT         REFERENCES threads(id) ON DELETE SET NULL,
  -- org_feeds.slug (on org_id) holding this run's per-step discussions.
  discussion_feed      VARCHAR(50),
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, slug)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_runs_default ON lms_runs (course_id) WHERE is_default;
CREATE INDEX IF NOT EXISTS idx_lms_runs_workshop ON lms_runs (workshop_thread_id) WHERE workshop_thread_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS lms_run_staff (
  run_id      TEXT  NOT NULL REFERENCES lms_runs(id) ON DELETE CASCADE,
  user_id     UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL DEFAULT 'guide' CHECK (role IN ('guide', 'mentor')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, user_id)
);

CREATE TABLE IF NOT EXISTS lms_entitlements (
  id          TEXT         PRIMARY KEY,
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id   TEXT         NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
  org_id      VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source      VARCHAR(12)  NOT NULL CHECK (source IN ('free', 'role', 'rsvp', 'order', 'grant')),
  source_ref  TEXT         NOT NULL DEFAULT '',
  granted_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  granted_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ,
  UNIQUE (user_id, course_id, source, source_ref)
);

CREATE TABLE IF NOT EXISTS lms_enrolments (
  id            TEXT         PRIMARY KEY,
  run_id        TEXT         NOT NULL REFERENCES lms_runs(id) ON DELETE CASCADE,
  course_id     TEXT         NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id        VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status        VARCHAR(12)  NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'paused', 'completed', 'withdrawn')),
  -- What offset/drip rules count from: run start for a cohort, else enrolment.
  anchor_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- Where "Continue" goes.
  last_step_id  TEXT         REFERENCES lms_steps(id) ON DELETE SET NULL,
  last_seen_at  TIMESTAMPTZ,
  enrolled_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  -- One seat per person per run, from the first migration.
  UNIQUE (run_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_lms_enrolments_user ON lms_enrolments (user_id, status);
