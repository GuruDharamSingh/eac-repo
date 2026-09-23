-- ============================================================================
-- 142: Sophia — RECORD layer. What each person did.
--
-- lms_step_state is the truth the UI reads. lms_events is an append-only log
-- written in the same transaction, shaped like an xAPI/cmi5 statement (actor,
-- verb, object + version, registration = enrolment, result, two timestamps) so
-- it can be exported one day and is never required to be.
--
-- What a person WROTE lives in lms_responses, outside the log, so it can be
-- deleted on request without rewriting history. Reflections are private by
-- default: `visibility` is chosen per entry by the learner and enforced in
-- services — never read these tables around @elkdonis/lms.
-- ============================================================================

CREATE TABLE IF NOT EXISTS lms_step_state (
  enrolment_id     TEXT         NOT NULL REFERENCES lms_enrolments(id) ON DELETE CASCADE,
  step_id          TEXT         NOT NULL REFERENCES lms_steps(id) ON DELETE CASCADE,
  org_id           VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status           VARCHAR(12)  NOT NULL DEFAULT 'started'
                     CHECK (status IN ('started', 'completed', 'waived')),
  -- The version that was in front of them when it was completed.
  step_version_id  TEXT         REFERENCES lms_step_versions(id) ON DELETE SET NULL,
  started_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  waived_by        UUID         REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (enrolment_id, step_id)
);

CREATE TABLE IF NOT EXISTS lms_responses (
  id               TEXT         PRIMARY KEY,
  enrolment_id     TEXT         NOT NULL REFERENCES lms_enrolments(id) ON DELETE CASCADE,
  run_id           TEXT         NOT NULL REFERENCES lms_runs(id) ON DELETE CASCADE,
  step_id          TEXT         NOT NULL REFERENCES lms_steps(id) ON DELETE CASCADE,
  step_version_id  TEXT         REFERENCES lms_step_versions(id) ON DELETE SET NULL,
  user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id           VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- reflection: answer to the step's prompt.  practice_log: "I did this" + note.
  -- note: a private word to the guide, from any step.
  kind             VARCHAR(16)  NOT NULL DEFAULT 'reflection'
                     CHECK (kind IN ('reflection', 'practice_log', 'note')),
  body             TEXT         NOT NULL,
  visibility       VARCHAR(12)  NOT NULL DEFAULT 'me'
                     CHECK (visibility IN ('me', 'guide', 'circle', 'public')),
  -- The AI seam. Off, and nothing reads it yet.
  ai_readable      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lms_responses_mine ON lms_responses (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lms_responses_run ON lms_responses (run_id, step_id, visibility);

-- A guide noticing a response. Never a gate on progress.
CREATE TABLE IF NOT EXISTS lms_acknowledgements (
  id           TEXT         PRIMARY KEY,
  response_id  TEXT         NOT NULL REFERENCES lms_responses(id) ON DELETE CASCADE,
  guide_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body         TEXT,
  audio_url    TEXT,
  seen_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (body IS NOT NULL OR audio_url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_lms_ack_response ON lms_acknowledgements (response_id);

-- Append-only. No foreign keys on purpose: the log outlives what it describes.
CREATE TABLE IF NOT EXISTS lms_events (
  id                 BIGSERIAL    PRIMARY KEY,
  org_id             VARCHAR(50)  NOT NULL,
  actor_id           UUID,
  actor_type         VARCHAR(8)   NOT NULL DEFAULT 'human' CHECK (actor_type IN ('human', 'ai', 'system')),
  verb               VARCHAR(40)  NOT NULL,
  object_type        VARCHAR(20)  NOT NULL,
  object_id          TEXT         NOT NULL,
  object_version_id  TEXT,
  enrolment_id       TEXT,
  result             JSONB,
  occurred_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  recorded_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lms_events_enrolment ON lms_events (enrolment_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_lms_events_actor ON lms_events (actor_id, occurred_at);

CREATE OR REPLACE FUNCTION lms_events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'lms_events is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_lms_events_append_only ON lms_events;
CREATE TRIGGER trg_lms_events_append_only
  BEFORE UPDATE OR DELETE ON lms_events
  FOR EACH ROW EXECUTE FUNCTION lms_events_append_only();

-- The assertion that someone earned an achievement. Immutable but revocable.
CREATE TABLE IF NOT EXISTS lms_awards (
  id              TEXT         PRIMARY KEY,
  achievement_id  TEXT         NOT NULL REFERENCES lms_achievements(id) ON DELETE CASCADE,
  user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrolment_id    TEXT         REFERENCES lms_enrolments(id) ON DELETE SET NULL,
  evidence        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  awarded_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ,
  -- One award per person per achievement, from the first migration.
  UNIQUE (achievement_id, user_id)
);
