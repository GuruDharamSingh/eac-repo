-- 105: what a person chooses to show on their own profile page.
--
-- There was no per-person "sections on my page" model at all. `org_feeds`
-- (073) is the org-scoped equivalent and the right precedent — sections as
-- data rather than as a CHECK constraint or a hardcoded component list — but
-- it keys on org_id and cannot express "Eric wants the Elkdonis blog on his
-- page while Michele doesn't".
--
-- A JSONB column rather than a `profile_sections` table because the shape is
-- one small object per person read on every profile render and written rarely,
-- with no need to query across people by section. If that changes — ordering
-- sections, or asking "who is showing a store" — promote it to a table then.
--
-- Known keys so far:
--   { "elkdonisFeed": true, "store": true }
-- Unknown keys are ignored by readers, so a newer app writing a section an
-- older one doesn't render degrades to not showing it, which is the same
-- fail-soft posture the org_feeds reads take.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_sections JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN users.profile_sections IS
  'Optional sections a person opts into on their own profile page, e.g. {"elkdonisFeed":true}. Readers ignore unknown keys.';
