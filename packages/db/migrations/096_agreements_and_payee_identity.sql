-- ============================================================================
-- Migration 096: the maker is the payee; a store is a front; splits come from
--                an agreement the artist actually accepted
-- ============================================================================
-- Migrations 094 and 095 built toward a store that *receives* money. That was
-- wrong, and this corrects it (user, 2026-09-05):
--
--   "artists are main recipients of all transactions, stores are just fronts,
--    when something is purchased through a store it is just a log of where its
--    presented through"
--
-- So the money model is:
--
--   * The **maker** of the work is the payee. A store never is.
--   * `commerce_order.store_id` stays exactly what it is — a log of where the
--     piece was presented. It answers "through whom", not "to whom".
--   * An org takes a cut ONLY where the artist has accepted an agreement with
--     that org. No accepted agreement means no claim: the artist takes 100%
--     and the store log still shows the org presented the work (decided
--     2026-09-05). Money is never split on terms nobody agreed to.
--   * An org's share is NOT a Stripe destination. It accrues to the host
--     account, earmarked to that org. Orgs therefore never hold a connected
--     account and never face KYC (decided 2026-09-05).
--   * Work with no maker — an org's own print or merch — earmarks the whole
--     amount to the org (decided 2026-09-05).
--
-- Two consequences follow mechanically, and this migration is mostly them:
-- payout identity belongs on the person, not on a front; and an agreement has
-- to be a real, versioned, accepted-by-somebody record rather than a number
-- sitting on a store row.
-- ============================================================================

-- ─── 1. Payout identity belongs to the person ───────────────────────────────
--
-- A connected account is a person's, and they have one however many fronts
-- present their work. Hanging it off a store meant a Stripe account per shop
-- window, and an artist selling through two orgs onboarding twice.

ALTER TABLE users
  ADD COLUMN payout_email        text,
  ADD COLUMN payout_method       text NOT NULL DEFAULT 'etransfer',
  ADD COLUMN stripe_account_id   text,
  ADD COLUMN stripe_onboarded_at timestamptz;

-- 094's fields, now homeless. There were no rows, so nothing is carried over.
ALTER TABLE store DROP CONSTRAINT IF EXISTS store_stripe_account_party;
ALTER TABLE store
  DROP COLUMN stripe_account_kind,
  DROP COLUMN stripe_account_user_id,
  DROP COLUMN stripe_account_org_id,
  DROP COLUMN stripe_account_id,
  DROP COLUMN stripe_onboarded_at;

-- A front is not paid, so its payout config cannot be required. Kept rather
-- than dropped only because ~20 call sites still read them; nothing decides
-- money from them any more.
ALTER TABLE store ALTER COLUMN payout_email DROP NOT NULL;

CREATE INDEX idx_users_stripe_account ON users (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

COMMENT ON COLUMN users.stripe_account_id IS
  'Stripe Express connected account for this person. NULL means settle through the core NFP account by hand — the mandatory fallback for payees who never finish KYC.';
COMMENT ON COLUMN users.stripe_onboarded_at IS
  'When Stripe reported the account payouts-enabled. NULL while onboarding is incomplete or stalled — an account id exists from the moment onboarding starts, so it cannot answer "payable yet" alone.';
COMMENT ON TABLE store IS
  'A front: where work is presented, within one org''s marketplace. NOT a payee — the maker is (migration 096). Owned by a person or an organization. Was marketplace_artists.';
COMMENT ON COLUMN store.payout_email IS
  'DEPRECATED — a front is not paid. Read users.payout_email for the maker.';
COMMENT ON COLUMN store.commission_rate IS
  'DEPRECATED — an org''s cut comes from an accepted org_agreement, not from the front. Retained until call sites migrate.';

-- ─── 2. Agreements ──────────────────────────────────────────────────────────
--
-- Shaped after questionnaires (088/089), the repo's existing org-authored,
-- versioned, jsonb-bodied precedent: an org writes these, a member accepts
-- them, and both facts are auditable afterwards.
--
-- Versioned because that is the whole point of an agreement. An acceptance
-- binds to ONE version; changing the terms means a new version and a new
-- acceptance, so an org can never move an artist's percentage under them.

CREATE TABLE org_agreements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        varchar(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Stable across versions; (org_id, key) is the agreement, + version is a text.
  key           text         NOT NULL,
  version       integer      NOT NULL DEFAULT 1,

  title         text         NOT NULL,
  summary       text,
  -- What the member is shown and accepts. Sanitised on write.
  body_html     text,

  -- The machine-readable half — the only part settlement reads. Kept as a
  -- plain column rather than buried in `terms` because it decides money and
  -- deserves to be greppable, constrainable and indexable.
  revenue_share_percent numeric(5,2) NOT NULL DEFAULT 0,
  -- Room for per-kind rates, caps, term lengths, without a migration each time.
  terms         jsonb        NOT NULL DEFAULT '{}',

  -- draft | active | retired. App-validated, no CHECK (073/091/093).
  status        text         NOT NULL DEFAULT 'draft',
  -- Whether an org may ASK members to accept this, vs. it being informational.
  requires_acceptance boolean NOT NULL DEFAULT true,

  created_by    uuid         REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  published_at  timestamptz,
  retired_at    timestamptz,

  UNIQUE (org_id, key, version),
  CONSTRAINT org_agreements_share_range
    CHECK (revenue_share_percent >= 0 AND revenue_share_percent <= 100)
);

CREATE INDEX idx_org_agreements_org ON org_agreements (org_id, status);
-- At most one live version of a given agreement per org: a member cannot be
-- asked to hold two contradictory active contracts under the same key.
CREATE UNIQUE INDEX org_agreements_one_active
  ON org_agreements (org_id, key) WHERE status = 'active';

CREATE TABLE org_agreement_acceptances (
  agreement_id uuid        NOT NULL REFERENCES org_agreements(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_at  timestamptz NOT NULL DEFAULT now(),
  -- Withdrawal is a fact, not a delete: a sale settled while an agreement was
  -- live stays explained by it afterwards.
  revoked_at   timestamptz,
  PRIMARY KEY (agreement_id, user_id)
);

CREATE INDEX idx_agreement_acceptances_user
  ON org_agreement_acceptances (user_id) WHERE revoked_at IS NULL;

CREATE TRIGGER trg_org_agreements_touch
  BEFORE UPDATE ON org_agreements
  FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();

COMMENT ON TABLE org_agreements IS
  'Terms an org offers its members — principally the org''s revenue share. Versioned: an acceptance binds to one version, so terms cannot change under someone who already agreed.';
COMMENT ON TABLE org_agreement_acceptances IS
  'A member accepted one version of one agreement. This, back-checked against the store an order was presented through, is what authorises a split.';
COMMENT ON COLUMN org_agreements.revenue_share_percent IS
  'The ORG''s cut, 0-100. 0 means the org takes nothing. Earmarked to the org inside the host Stripe account, never paid to an org-held connected account.';

-- ─── 3. An order line explains its own split ────────────────────────────────
--
-- Previously the split was recomputed from whatever commission_rate the store
-- happened to hold at the time, with nothing recorded about why. Since the
-- split now comes from a specific accepted agreement, the line records which
-- one — so a settlement can be re-derived, disputed, or audited years later
-- without depending on rows that have since been edited.

ALTER TABLE commerce_order_line
  ADD COLUMN agreement_id      uuid REFERENCES org_agreements(id) ON DELETE SET NULL,
  ADD COLUMN org_share_percent numeric(5,2) NOT NULL DEFAULT 0,
  -- The org earmarked for this line: the split counterparty, or the whole
  -- payee when the work has no maker.
  ADD COLUMN payee_org_id      varchar(50) REFERENCES organizations(id) ON DELETE SET NULL,
  -- The front it was presented through — the log, kept per line so it survives
  -- independently of the order and of the store row itself.
  ADD COLUMN presented_store_id uuid REFERENCES store(id) ON DELETE SET NULL;

CREATE INDEX idx_order_line_agreement ON commerce_order_line (agreement_id)
  WHERE agreement_id IS NOT NULL;
CREATE INDEX idx_order_line_payee_org ON commerce_order_line (payee_org_id)
  WHERE payee_org_id IS NOT NULL;

COMMENT ON COLUMN commerce_order_line.artist_user_id IS
  'The maker, and the payee for this line. NULL only when the work has no maker, in which case the whole amount is earmarked to payee_org_id.';
COMMENT ON COLUMN commerce_order_line.agreement_id IS
  'The accepted agreement that authorised org_share_percent. NULL means no agreement was in force and the maker took 100%.';
COMMENT ON COLUMN commerce_order_line.gallery_share_minor IS
  'The ORG''s earmarked share, derived from agreement_id at sale time. Held in the host account against payee_org_id, not transferred to an org account.';
COMMENT ON COLUMN commerce_order_line.presented_store_id IS
  'Which front presented the work. A log of "through whom", never "to whom".';
