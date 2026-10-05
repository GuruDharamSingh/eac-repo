-- ============================================================================
-- 175: Education Hub — which workshops it lists, and what a past one offers.
--
-- Workshops stay what they are (threads kind='workshop' + workshop_pages +
-- workshop_sessions, written by upsertWorkshopOffering). The hub (apps/sophia)
-- only lists them and links out to each workshop's own page, where sign-up,
-- payment and the materials already live. This table holds the hub's own
-- choices, one row per listed workshop, so nothing here touches the
-- workshop tables or their writers.
--
--   listed        the organiser opted this workshop into the hub
--   after_access  once it has ended: 'none' (not offered), 'free', or 'paid'
--   after_price   the price of a past workshop's recordings and materials
--   link_override where to send people, when the default page link is wrong
--                 (orgs on their own domain, other than the inner group)
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS lms_workshop_listings (
  thread_id     VARCHAR(21)   PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
  listed        BOOLEAN       NOT NULL DEFAULT FALSE,
  after_access  VARCHAR(10)   NOT NULL DEFAULT 'none' CHECK (after_access IN ('none', 'free', 'paid')),
  after_price   NUMERIC(10,2) CHECK (after_price IS NULL OR after_price > 0),
  link_override TEXT,
  updated_by    UUID          REFERENCES users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT lms_workshop_listings_paid_has_price CHECK (after_access <> 'paid' OR after_price IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_lms_workshop_listings_listed ON lms_workshop_listings(listed) WHERE listed;

COMMIT;
