-- Wizards, questionnaires and polls become one thing, addressable as content.
--
-- There were five parallel implementations of "ask people something and
-- collect the answers", spread over fourteen tables:
--
--   questionnaires + questionnaire_responses     2 rows / 2 rows   (fields JSONB)
--   work_questions + work_question_responses     1 row  / 5 rows
--   availability_polls + _options + _responses   0 / 0 / 0
--   availability_responses                       0
--   poll_options + poll_votes                    0 / 0
--   question_polls + _options + _votes           0 / 0 / 0
--   org_intake                                   1 row  (answers JSONB)
--
-- plus the onboarding wizard writing its answers into ~30 dedicated columns on
-- artist_profiles, and pigeonshoot's rubric-as-data. Twelve of the fourteen
-- tables have never held a row.
--
-- `questionnaires` is the survivor because it is already the general shape:
-- `fields JSONB` is an authored list of question descriptors and
-- `questionnaire_responses.answers JSONB` is the filled-in blob. A poll is not
-- a different structure — it is a questionnaire whose field list is a single
-- choice question and whose results are visible to the people who answered.
-- `closes_at`, `status` and `results_visibility` already existed and are
-- everything a poll needs beyond the ballot.
--
-- This migration is deliberately additive. The eight empty poll tables are NOT
-- dropped here: four of them still have code referencing them
-- (inner-gathering's poll-voting component and its availability views), and
-- dropping a table out from under live code is how you get the `apps/forum`
-- situation — that app queries `posts`/`meetings`, which migration 030
-- dropped, so every one of its pages 500s. Retire them in a later migration,
-- after their consumers move over.

-- ── A questionnaire can BE a piece of content ────────────────────────────────
--
-- Threads carry publishing, feeds, org scoping, RSVP eligibility and subdomain
-- rendering. A questionnaire that is a thread inherits all of it instead of
-- re-implementing each one. `threads` has no CHECK on `kind` (deliberately —
-- see migration 073's replacement of the `section` CHECK by `org_feeds`), so
-- 'questionnaire' and 'poll' are usable as kinds with no further schema change.
--
-- NULL thread_id stays legal and is the default: the two live rows
-- (artist-intake, collective-business) are hub workbooks, not published
-- content, and should not appear in a feed.
ALTER TABLE questionnaires
  ADD COLUMN IF NOT EXISTS thread_id VARCHAR(21) REFERENCES threads(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_questionnaires_thread
  ON questionnaires (thread_id)
  WHERE thread_id IS NOT NULL;

-- ── What kind of asking this is ──────────────────────────────────────────────
--
-- Only presentation and defaults differ: a `poll` renders its one question as
-- a ballot with a result bar, a `questionnaire` renders a form, a `wizard`
-- renders the same fields paginated into steps. The storage is identical,
-- which is the point.
ALTER TABLE questionnaires
  ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'questionnaire';

ALTER TABLE questionnaires
  DROP CONSTRAINT IF EXISTS questionnaires_kind_check;

ALTER TABLE questionnaires
  ADD CONSTRAINT questionnaires_kind_check
  CHECK (kind IN ('questionnaire', 'poll', 'wizard'));

-- The two existing rows are multi-step onboarding flows, not forms.
UPDATE questionnaires SET kind = 'wizard'
  WHERE key IN ('artist-intake', 'collective-business') AND kind = 'questionnaire';

-- ── Who may see the results ──────────────────────────────────────────────────
--
-- Was admins|members, which cannot express a poll: the whole point of a poll
-- is that answering shows you the tally. 'respondents' is that case, and
-- 'public' covers a published poll on an org's own subdomain, where the
-- results are the content.
ALTER TABLE questionnaires
  DROP CONSTRAINT IF EXISTS questionnaires_results_visibility_check;

ALTER TABLE questionnaires
  ADD CONSTRAINT questionnaires_results_visibility_check
  CHECK (results_visibility IN ('admins', 'members', 'respondents', 'public'));

-- `gates_tier` is deliberately left alone. It reads member|host|partner, which
-- looks like drift against organizations.tier (free|supported|partner) but is
-- not: it gates `users.network_tier`, a separate vocabulary with its own
-- ladder, and all 50 users currently sit at 'member'. Two tier concepts, both
-- correct — see ReviewActions.tsx's promotion order.
