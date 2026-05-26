-- Migration 046: landing_inquiries
-- Anonymous responses to the landing-page "What is art for?" prompt.
-- No PII required; tracks an IP hash for soft rate-limiting only.

CREATE TABLE IF NOT EXISTS landing_inquiries (
  id          BIGSERIAL PRIMARY KEY,
  org_id      TEXT NOT NULL DEFAULT 'elkdonis'
                REFERENCES organizations(id) ON DELETE CASCADE,
  prompt      TEXT NOT NULL,
  answer      TEXT NOT NULL,
  ip_hash     TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landing_inquiries_org_created
  ON landing_inquiries (org_id, created_at DESC);
