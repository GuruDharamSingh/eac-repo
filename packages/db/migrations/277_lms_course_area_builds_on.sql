-- 277: course tags for the dock's course picker (Justin 2026-11-16). NOT APPLIED when written.
-- area: one of the broad areas; builds_on: slugs of the courses this one builds on (derived from the track nexus,
-- packages/actions/atlas/tracks). Both optional; reads are tolerant of the columns being absent.
ALTER TABLE lms_courses
  ADD COLUMN IF NOT EXISTS area VARCHAR(30)
    CHECK (area IS NULL OR area IN ('profile','publishing','business','site','production','artwork','email','organisation')),
  ADD COLUMN IF NOT EXISTS builds_on TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_lms_courses_area ON lms_courses (area) WHERE area IS NOT NULL;
