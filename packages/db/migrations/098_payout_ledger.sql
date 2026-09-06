-- ============================================================================
-- Migration 098: an append-only ledger, because an org has nowhere to be paid
-- ============================================================================
-- Two things are broken without this, and both are live:
--
--   1. `payout.artist_user_id` is NOT NULL, so confirming payment on an
--      org-owned piece — which has no maker since migration 095 — throws.
--   2. The org's share (`commerce_order_line.gallery_share_minor`) is computed,
--      recorded on the line, and then goes nowhere. Nothing accrues it, holds
--      it, or pays it out. An org "earmarked inside the host account" was a
--      comment, not a record.
--
-- The shape (decided 2026-09-05):
--
--   * **Append-only.** A balance is derived by summing entries, never stored
--     and mutated. A reversal is a new negative entry. That gives an audit
--     trail, which matters the moment this feeds an NFP's books.
--   * **The party is polymorphic from the start** — user, org or platform.
--     This is the whole point: it is what lets an org hold a balance at all,
--     and retrofitting it later would mean rewriting every payout query.
--   * **Two release triggers only** (decided 2026-09-05): the payee's account
--     completing KYC, and an admin releasing manually. Reaching a payout
--     threshold and a member claiming an unowned org do NOT auto-release —
--     micro-shares still accrue, they just do not become payable by themselves.
--
-- Note what this table replaces. The brief proposed a separate
-- `order_line_share` for the third-party (curator, referrer) case. It is not
-- needed: an accrual against an `order_line_id` IS a share, so a curator's cut
-- is simply another accrual row on the same line. One table, no dual-write, no
-- second place for a split to disagree with itself.
-- ============================================================================

CREATE TABLE payout_ledger (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ─── Who ─────────────────────────────────────────────────────────────────
  -- 'user' | 'org' | 'platform'. App-validated, no CHECK (073/091/093).
  -- 'platform' is the collective itself and names neither id column.
  party_kind    text        NOT NULL,
  party_user_id uuid        REFERENCES users(id) ON DELETE SET NULL,
  party_org_id  varchar(50) REFERENCES organizations(id) ON DELETE SET NULL,

  -- ─── What ────────────────────────────────────────────────────────────────
  -- 'accrual' | 'release' | 'payout' | 'adjustment' | 'refund'
  entry_type   text        NOT NULL,
  -- Signed. Accrual positive, payout and refund negative, adjustment either.
  -- A release moves money from held to payable and so is always 0 — it changes
  -- payability, not the balance.
  amount_minor bigint      NOT NULL,
  currency     char(3)     NOT NULL,

  -- ─── Why ─────────────────────────────────────────────────────────────────
  order_id      uuid REFERENCES commerce_order(id) ON DELETE SET NULL,
  order_line_id uuid REFERENCES commerce_order_line(id) ON DELETE SET NULL,
  -- What authorised an org's cut. NULL on a maker's own accrual.
  agreement_id  uuid REFERENCES org_agreements(id) ON DELETE SET NULL,

  -- ─── Payability ──────────────────────────────────────────────────────────
  -- NULL means payable on arrival. Otherwise one of:
  --   no_payout_account  the payee has not finished Stripe onboarding
  --   below_threshold    accrued, but under the micro-share floor
  --   org_unowned        an associated org nobody has claimed yet
  --   dispute_window     the refund window has not elapsed
  -- Distinguished because they resolve differently, even though only two
  -- things actually trigger a release.
  hold_reason  text,
  -- A release entry names the accrual it frees. Nothing is ever mutated: an
  -- accrual is payable if it was born payable, or if a release points at it.
  releases_entry_id uuid REFERENCES payout_ledger(id) ON DELETE SET NULL,
  -- The transfer that settled this, once one exists.
  payout_id    uuid REFERENCES payout(id) ON DELETE SET NULL,

  note         text,
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),

  -- A party is exactly one thing, or the platform, which is neither.
  CONSTRAINT payout_ledger_one_party CHECK (
    (party_kind = 'platform' AND party_user_id IS NULL AND party_org_id IS NULL)
    OR (party_user_id IS NOT NULL) <> (party_org_id IS NOT NULL)
  ),
  -- A release changes payability, never the balance.
  CONSTRAINT payout_ledger_release_is_zero CHECK (
    entry_type <> 'release' OR amount_minor = 0
  )
);

-- Balance queries always scope by party, so that is the index.
CREATE INDEX idx_payout_ledger_user ON payout_ledger (party_user_id, currency)
  WHERE party_user_id IS NOT NULL;
CREATE INDEX idx_payout_ledger_org ON payout_ledger (party_org_id, currency)
  WHERE party_org_id IS NOT NULL;
CREATE INDEX idx_payout_ledger_order ON payout_ledger (order_id)
  WHERE order_id IS NOT NULL;
-- The admin queue: everything still held, oldest first.
CREATE INDEX idx_payout_ledger_held ON payout_ledger (created_at)
  WHERE hold_reason IS NOT NULL;
CREATE INDEX idx_payout_ledger_releases ON payout_ledger (releases_entry_id)
  WHERE releases_entry_id IS NOT NULL;

-- One accrual per (party, line): re-confirming a payment must not pay twice.
-- Partial so releases, payouts and adjustments are unconstrained.
CREATE UNIQUE INDEX payout_ledger_one_accrual_per_line
  ON payout_ledger (
    order_line_id,
    party_kind,
    COALESCE(party_user_id::text, party_org_id, 'platform')
  )
  WHERE entry_type = 'accrual' AND order_line_id IS NOT NULL;

COMMENT ON TABLE payout_ledger IS
  'Append-only record of what each party is owed. Balances are derived by summing, never stored. A reversal is a new negative entry. Also subsumes per-line shares: an accrual against an order_line_id IS that party''s share of the line, so a curator cut is another accrual on the same line rather than a second table.';
COMMENT ON COLUMN payout_ledger.party_kind IS
  '''user'' | ''org'' | ''platform''. An org can only ever hold a balance here — it has no connected account and receives no transfer (migration 096).';
COMMENT ON COLUMN payout_ledger.amount_minor IS
  'Signed minor units. Accrual positive, payout/refund negative, release always 0 — a release changes payability, not the balance.';
COMMENT ON COLUMN payout_ledger.hold_reason IS
  'NULL = payable. Otherwise no_payout_account | below_threshold | org_unowned | dispute_window. Only two things release a hold: the payee completing KYC, and an admin acting (decided 2026-09-05).';

-- ─── payout becomes the record of an actual transfer ────────────────────────
--
-- It was the only record that money was owed, and could only name a person.
-- Now the ledger says what is owed; this says what was actually sent.

ALTER TABLE payout ALTER COLUMN artist_user_id DROP NOT NULL;
ALTER TABLE payout ADD COLUMN party_org_id varchar(50)
  REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE payout ADD CONSTRAINT payout_one_party CHECK (
  (artist_user_id IS NOT NULL) <> (party_org_id IS NOT NULL)
);

COMMENT ON TABLE payout IS
  'A transfer that actually happened. What is OWED lives in payout_ledger; this records settling some of it. An org payout is an internal drawdown from the host account, not a transfer to an org-held account.';
COMMENT ON COLUMN payout.artist_user_id IS
  'The person paid. NULL when the payee is an org — see party_org_id.';
