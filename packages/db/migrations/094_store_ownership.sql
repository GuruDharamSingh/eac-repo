-- ============================================================================
-- Migration 094: a store may be owned by a person OR an organization
-- ============================================================================
-- `marketplace_artists` was named for the only seller it could describe. The
-- collective's org owners now need to sell *as the organization* — "a more
-- official publication say than just the user within" — and that is not a
-- shape the old table can hold: user_id was NOT NULL and half the primary key.
--
-- So this renames the table to what it always was (a store) and makes its
-- owner polymorphic. `marketplace_artists` becomes exactly the
-- owner_kind = 'user' case; nothing about a person's store changes.
--
-- Done now because every commerce table is still empty (0 stores, 0 artwork,
-- 1 test order). Migration 092 fixed this table's last structural mistake
-- under the same window; retrofitting ownership after real sellers exist
-- would mean reconciling live payout config.
--
-- Two things are deliberately NOT here, both deferred on 2026-09-05:
--   * `closes_at` — temporary / pop-up stores.
--   * per-store commission defaults — the flat 30% stands.
-- ============================================================================

-- ─── 1. The table is a store ────────────────────────────────────────────────

ALTER TABLE marketplace_artists RENAME TO store;

ALTER INDEX idx_marketplace_artists_org         RENAME TO idx_store_org;
ALTER INDEX idx_marketplace_artists_status      RENAME TO idx_store_status;
ALTER INDEX idx_marketplace_artists_applied_at  RENAME TO idx_store_applied_at;
ALTER INDEX idx_marketplace_artists_pending     RENAME TO idx_store_pending;

ALTER TABLE store RENAME COLUMN user_id TO owner_user_id;

-- Constraints and triggers keep their names through a table rename; rename
-- them too so nothing in the schema still says "marketplace_artists".
ALTER TABLE store RENAME CONSTRAINT marketplace_artists_status_check   TO store_status_check;
ALTER TABLE store RENAME CONSTRAINT marketplace_artists_org_id_fkey    TO store_org_id_fkey;
ALTER TABLE store RENAME CONSTRAINT marketplace_artists_user_id_fkey   TO store_owner_user_id_fkey;
ALTER TABLE store RENAME CONSTRAINT marketplace_artists_reviewed_by_fkey TO store_reviewed_by_fkey;
ALTER TRIGGER trg_marketplace_artists_touch ON store RENAME TO trg_store_touch;

-- A surrogate key. The old (user_id, org_id) PK cannot address an org-owned
-- store, and downstream tables (commerce_order.store_id in the next step, the
-- payout ledger after that) need one column to point at.
ALTER TABLE store ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE store DROP CONSTRAINT marketplace_artists_pkey;
ALTER TABLE store ADD CONSTRAINT store_pkey PRIMARY KEY (id);

-- ─── 2. Polymorphic ownership ───────────────────────────────────────────────
--
-- `org_id` and `owner_org_id` are different things and both are needed:
--   org_id       which marketplace the store trades in  (context)
--   owner_org_id which organization takes the revenue   (owner)
-- An IFAC-owned store selling on the `market` marketplace is
-- (org_id='market', owner_org_id='ifac'). Collapsing them would forbid it.

ALTER TABLE store ALTER COLUMN owner_user_id DROP NOT NULL;

ALTER TABLE store ADD COLUMN owner_org_id varchar(50)
  REFERENCES organizations(id) ON DELETE CASCADE;

-- Generated, not stored-and-maintained: a discriminator that can be derived is
-- a discriminator that will eventually disagree with the columns it describes.
-- This keeps queries readable (`WHERE owner_kind = 'org'`) with no drift, and
-- a third owner kind later means editing one expression.
ALTER TABLE store ADD COLUMN owner_kind text
  GENERATED ALWAYS AS (
    CASE WHEN owner_org_id IS NOT NULL THEN 'org' ELSE 'user' END
  ) STORED;

-- A shape invariant, not an enum. The repo's data-not-DDL convention (073,
-- 091, 093) is about open value sets that grow — it does not ask us to let a
-- store have two owners or none.
ALTER TABLE store ADD CONSTRAINT store_one_owner CHECK (
  (owner_user_id IS NOT NULL AND owner_org_id IS NULL)
  OR
  (owner_user_id IS NULL AND owner_org_id IS NOT NULL)
);

-- One store per owner per marketplace, enforced for each owner kind. Partial
-- so the NULL half of the polymorphic pair never collides with itself.
CREATE UNIQUE INDEX store_user_owner_per_org
  ON store (org_id, owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE UNIQUE INDEX store_org_owner_per_org
  ON store (org_id, owner_org_id) WHERE owner_org_id IS NOT NULL;

-- ─── 3. Stripe: a connected account, and whose it is ────────────────────────
--
-- Decided 2026-09-05: Stripe Express *and* the core NFP account, routed per
-- payee. Payout mode is derived from whether stripe_account_id is set rather
-- than being a separate setting that can fall out of sync with reality:
--
--   set   → destination charge with an application fee; Stripe pays them out.
--   NULL  → charge the platform account, record what is owed, settle by hand.
--
-- The fallback is mandatory, not a stopgap. Express onboarding is KYC and some
-- payees will never finish it.

ALTER TABLE store ADD COLUMN stripe_account_id text;

-- Whose account that is. For an org-owned store this is a real choice, not a
-- derivable one (decided 2026-09-05, "either — recorded per store"): a claimed
-- associated business may start out settling to the claiming member's personal
-- Express account and move to its own later. Recording the party explicitly
-- means "who received this money" is answerable without inferring it from
-- ownership at read time — and ownership can change.
ALTER TABLE store ADD COLUMN stripe_account_user_id uuid
  REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE store ADD COLUMN stripe_account_org_id varchar(50)
  REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE store ADD COLUMN stripe_account_kind text
  GENERATED ALWAYS AS (
    CASE
      WHEN stripe_account_org_id  IS NOT NULL THEN 'org'
      WHEN stripe_account_user_id IS NOT NULL THEN 'user'
      ELSE NULL
    END
  ) STORED;

-- No account means no party; an account means exactly one party owns it.
ALTER TABLE store ADD CONSTRAINT store_stripe_account_party CHECK (
  (stripe_account_id IS NULL
     AND stripe_account_user_id IS NULL
     AND stripe_account_org_id IS NULL)
  OR
  (stripe_account_id IS NOT NULL
     AND (stripe_account_user_id IS NOT NULL) <> (stripe_account_org_id IS NOT NULL))
);

-- KYC completing is one of the two things that release held money (decided
-- 2026-09-05; the other is an admin releasing it manually). A connected
-- account exists from the moment onboarding starts, so its id cannot answer
-- "is this payee payable yet" — this timestamp is the signal the payout
-- ledger will watch.
ALTER TABLE store ADD COLUMN stripe_onboarded_at timestamptz;

CREATE INDEX idx_store_stripe_account ON store (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

-- Stripe is now a payout method. Dropped rather than extended, per the
-- data-not-DDL convention: this list grows with every provider added to
-- packages/payments, and the provider registry there is its real source of
-- truth. Validated in app code against the registered providers.
ALTER TABLE store DROP CONSTRAINT IF EXISTS marketplace_artists_payout_method_check;

-- ─── 4. Who may act for a store ─────────────────────────────────────────────
--
-- A person's store has exactly one hand on it. An org's store does not: the
-- organization owns the revenue while some set of its members do the listing,
-- fulfilling and answering. That set is not the same as the org's membership
-- roll — being a member of IFAC should not let you price its work.

CREATE TABLE store_member (
  store_id  uuid        NOT NULL REFERENCES store(id) ON DELETE CASCADE,
  user_id   uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 'owner' | 'manager' | 'staff' — app-validated, no CHECK (073/091/093).
  role      text        NOT NULL DEFAULT 'manager',
  added_at  timestamptz NOT NULL DEFAULT now(),
  added_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (store_id, user_id)
);

CREATE INDEX idx_store_member_user ON store_member (user_id);

COMMENT ON TABLE store_member IS
  'Who may act for a store. Distinct from user_organizations: org membership is belonging, this is authority over the org''s commerce.';

-- ─── 5. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE store IS
  'A store within one org''s marketplace, owned by a person or by an organization. Commerce config only — payout, commission, currency, status. Identity lives on users / organizations (migrations 084, 092). Was marketplace_artists.';
COMMENT ON COLUMN store.org_id IS
  'The marketplace this store trades in. Not the owner — see owner_org_id.';
COMMENT ON COLUMN store.owner_org_id IS
  'The organization that owns the store and takes its revenue. An associated org may only own a store once a real member holds the ''owner'' role in it (decided 2026-09-05) — enforced in app code, since it depends on user_organizations.';
COMMENT ON COLUMN store.stripe_account_id IS
  'Stripe Express connected account. NULL means settle through the core NFP account manually — the mandatory fallback for payees who never finish KYC.';
COMMENT ON COLUMN store.stripe_onboarded_at IS
  'When Stripe reported the connected account payouts-enabled. NULL while onboarding is incomplete or stalled.';
COMMENT ON COLUMN store.display_name IS
  'DEPRECATED — read users.display_name / organizations.name. Retained until call sites migrate (see migration 092).';
