-- 287_lms_course_kind.sql
-- Workspace slice 2: mark which courses are workspaces (decision D1: a kind within the learning system).
-- ADDITIVE ONLY: one column with a default, so every existing course becomes kind 'course' and nothing about it changes.
--   lms_courses.kind  'course' (default) or 'workspace'
-- What the code does with it: a workspace's course page redirects to /workspaces/<slug>, and Studio marks workspaces as such.
-- Until this exists the code treats every course as a course (it tests for the column), so it fails soft.
--
-- NOT APPLIED by the worker who wrote it: the PM applies migrations.

ALTER TABLE lms_courses
  ADD COLUMN IF NOT EXISTS kind VARCHAR(12) NOT NULL DEFAULT 'course';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lms_courses_kind_check') THEN
    ALTER TABLE lms_courses ADD CONSTRAINT lms_courses_kind_check CHECK (kind IN ('course', 'workspace'));
  END IF;
END $$;
