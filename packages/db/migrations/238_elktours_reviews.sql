-- ============================================================================
-- 238: reviews — signed-in followers review places, tours and experiences (2026-11-02).
--
-- Nothing in the network fitted: astro_reviews / lamrim_reviews are the
-- owner's study marks, thread review (156) is a moderation gate, pigeonshoot
-- ratings are a card rubric. This is a small org-scoped table, generic in its
-- target so any org site can reuse it.
--
--   target_type  'place' | 'tour' | 'experience'   (place = places.id uuid,
--                tour/experience = threads.id; held as text)
--   rating       1..5, optional (a written note without stars is fine)
--   status       'visible' | 'hidden' — editors hide, authors delete their own
--   one review per person per target (an edit replaces it)
--
-- Public to read (visible only). Who may write is decided in code
-- (apps/elktours/src/lib/review-actions.ts): any signed-in person with a row
-- in user_organizations for the org, followers ('viewer') included.
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  target_type  text NOT NULL CHECK (target_type IN ('place','tour','experience')),
  target_id    text NOT NULL,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating       smallint CHECK (rating BETWEEN 1 AND 5),
  body         text,
  status       text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  hidden_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  hidden_at    timestamptz,
  hidden_reason text,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT org_reviews_has_content CHECK (rating IS NOT NULL OR (body IS NOT NULL AND length(trim(body)) > 0)),
  CONSTRAINT org_reviews_one_per_person UNIQUE (org_id, target_type, target_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_reviews_target ON org_reviews (org_id, target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_reviews_user ON org_reviews (user_id);

ALTER TABLE org_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON org_reviews;
CREATE POLICY tenant_isolation ON org_reviews FOR ALL TO eac_tenant
  USING (org_id::text = app_org_id()) WITH CHECK (org_id::text = app_org_id());
