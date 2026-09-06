-- ============================================================================
-- Migration 097: anything you can buy settles the same way
-- ============================================================================
-- An audit of every path where money changes hands (2026-09-05) found three
-- rails answering "who gets paid" three different ways:
--
--   artwork    the store's commission_rate — fixed by migrations 094-096
--   service    the SELLING APP'S configured email, so a practitioner's booking
--              fee went to the site's inbox rather than to them, and the org's
--              cut was a hardcoded zero
--   workshop   an environment variable, and no commerce_order at all — so a
--              paid workshop had no order, no line, no split and no way to be
--              marked paid. `workshop_join_requests.status` has never left
--              'pending' anywhere in the codebase (3 rows prove it).
--
-- The first two are fixed in code, on the shared resolver in
-- packages/commerce/src/server/settlement.ts. This migration is what the third
-- needs: a workshop enrolment has to point at a real order.
-- ============================================================================

ALTER TABLE workshop_join_requests
  ADD COLUMN order_id uuid REFERENCES commerce_order(id) ON DELETE SET NULL;

CREATE INDEX idx_workshop_join_requests_order
  ON workshop_join_requests (order_id) WHERE order_id IS NOT NULL;

COMMENT ON COLUMN workshop_join_requests.order_id IS
  'The commerce_order this enrolment is paying for. NULL on rows created before migration 097, which never had an order to point at.';
COMMENT ON COLUMN workshop_join_requests.status IS
  'pending | paid | cancelled. Driven by the linked order from migration 097 onward; rows without an order_id predate that and can only be resolved by hand.';

-- `threads.kind` is still a CHECK enum, which migrations 073/091/093 moved
-- away from everywhere else. Products and auction listings are already
-- planned as new kinds, and each one currently needs a migration to say a word
-- the app already understands. Dropped rather than extended; the kinds a
-- thread may take are validated in app code, as sections and entity types are.
ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_kind_check;

COMMENT ON COLUMN threads.kind IS
  'post | meeting | workshop | event | service | product | pigeon. App-validated (data-not-DDL, per 073/091/093) — adding a kind should not need a migration. Which kinds are purchasable is decided in @elkdonis/commerce, not here.';
