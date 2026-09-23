-- ============================================================================
-- 157: user_pages — a PERSON's own Puck documents, rendered inside an ORG's
--      page, one section (a store panel, to start) at a time.
--
-- Every page store in this repo so far is org-scoped (`site_config`, key
-- `puck:<slug>`) because every page so far belongs to an org. This is the
-- first page that belongs to a PERSON: an artist's store panel differs by
-- which org is hosting it — different items, different layout, a different
-- page count — which `site_config` cannot express (its key is per-org by
-- construction, not per-(person, org)).
--
-- `(user_id, org_id, key)` is the primary key, matching `site_themes`'s own
-- `(org_id, page_key)` shape one level down: a person, on one org, has one or
-- more keyed documents. `key` is `store:1`, `store:2`, … today — "multiple
-- pages of this one store section" is multiple ROWS, the same move migration
-- 146 made for a person's galleries, not a new pagination concept.
--
-- ── Moderation follows 156, not a new mechanism ─────────────────────────────
--
-- `status` uses the exact vocabulary threads_status_check settled on
-- (draft/pending/published/archived), for the same reason: every read in the
-- network already knows to filter on `status = 'published'`, and reusing the
-- word means reusing the instinct. A submitted panel is 'pending' — invisible
-- everywhere by construction, no query needs to change — until a guide
-- approves it or it is rejected back to 'archived' (never deleted, same as a
-- removed thread).
--
-- `organizations.member_store_panels` is the org's own switch, DEFAULT FALSE
-- — the opposite default from `member_posts_review`. That one defaults FALSE
-- because the owner asked for "anything by members can be posted" to be the
-- open default for a thread appended to a feed. A store panel is different in
-- kind: it is a person's OWN design rendered inside the org's layout, on the
-- org's own page, and an org should not wake up hosting member-authored
-- panels it never agreed to. Opt-in, not opt-out.
--
-- The DEFAULT panel (profile-store, StoreShowcase — a plain listing, no
-- design surface) is NOT gated by this column. It needs no row here and asks
-- nothing of the org's layout beyond what `profile_sections.store` already
-- grants; only a PUCK-DESIGNED panel is a new thing an org is agreeing to.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_pages (
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id      VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key         VARCHAR(50)  NOT NULL,
  data        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  status      VARCHAR(20)  NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft', 'pending', 'published', 'archived')),
  reviewed_by UUID         REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, org_id, key),
  -- Same boring-on-purpose rule as page-builder's own slug.ts: this is a
  -- storage key and half of one, so it stays predictable rather than merely
  -- valid JSON-safe text.
  CONSTRAINT user_pages_key_shape CHECK (key ~ '^[a-z][a-z0-9]*(:[0-9]{1,3})?$')
);

-- The public read: this org's published panels for this person, in order.
CREATE INDEX IF NOT EXISTS idx_user_pages_published
  ON user_pages (user_id, org_id, key) WHERE status = 'published';

-- The org's moderation queue — tiny compared to the table, read by org.
CREATE INDEX IF NOT EXISTS idx_user_pages_pending
  ON user_pages (org_id, created_at DESC) WHERE status = 'pending';

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS member_store_panels BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON TABLE user_pages IS
  'A person''s own Puck documents, one per (org, key) — a designed section rendered inside that org''s page. key is e.g. store:1, store:2.';
COMMENT ON COLUMN user_pages.status IS
  'draft/pending/published/archived — same vocabulary as threads_status_check (migration 156). pending is invisible everywhere by construction.';
COMMENT ON COLUMN organizations.member_store_panels IS
  'Whether this org hosts member-DESIGNED store panels at all. Default FALSE — opt-in, unlike member_posts_review. The undesigned default panel (profile-store) is not gated by this.';
