-- 209: art auction, phase A (docs/open/ART_AUCTION_PLAN_2026-10-18.md).
-- Artist credit apart from payment, provenance events ("donated by X to Y"),
-- a payee registry with per-org beneficiary lists, beneficiary on listings
-- and orders, lots tied to a series, series bidding settings, bidder
-- registration, and marketplace-wide settings. 2026-10-18.
--
-- Money rule carried by these columns: the store is the payee of a listing.
-- `artwork.artist_user_id` stays the maker who is paid; the new
-- `credited_artist_user_id` names an artist without paying them. A listing
-- whose beneficiary scope is `all_proceeds` sends the price (less processor
-- fee) to the payee; `commission` sends only the store's commission there.

-- ---------------------------------------------------------------------------
-- Artwork: credit, estimate
-- ---------------------------------------------------------------------------
ALTER TABLE artwork
  ADD COLUMN IF NOT EXISTS credited_artist_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credit_status text NOT NULL DEFAULT 'credited',
  ADD COLUMN IF NOT EXISTS estimate_low_minor bigint,
  ADD COLUMN IF NOT EXISTS estimate_high_minor bigint;

ALTER TABLE artwork DROP CONSTRAINT IF EXISTS artwork_credit_status_check;
ALTER TABLE artwork ADD CONSTRAINT artwork_credit_status_check
  CHECK (credit_status IN ('credited', 'rejected'));
ALTER TABLE artwork DROP CONSTRAINT IF EXISTS artwork_estimate_check;
ALTER TABLE artwork ADD CONSTRAINT artwork_estimate_check
  CHECK (estimate_low_minor IS NULL OR estimate_high_minor IS NULL
         OR estimate_low_minor <= estimate_high_minor);

CREATE INDEX IF NOT EXISTS idx_artwork_credited_artist
  ON artwork (credited_artist_user_id) WHERE credited_artist_user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Provenance events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artwork_provenance (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id   uuid NOT NULL REFERENCES artwork(id) ON DELETE CASCADE,
  org_id       varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('donated', 'consigned', 'acquired', 'commissioned')),
  -- The giver: a network user, or a name when they are not one.
  from_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  from_text    text,
  -- The receiver: an org on the network.
  to_org_id    varchar(50) REFERENCES organizations(id) ON DELETE SET NULL,
  occurred_on  date,
  note         text,
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_artwork_provenance_artwork
  ON artwork_provenance (artwork_id, occurred_on);

-- ---------------------------------------------------------------------------
-- Payees: where money can be directed. An org on the network, or an outside
-- charity. Orgs keep their own ordered list (org_beneficiaries).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payee (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind               text NOT NULL CHECK (kind IN ('org', 'charity')),
  org_id             varchar(50) REFERENCES organizations(id) ON DELETE CASCADE,
  name               text NOT NULL,
  registration_no    text,
  website            text,
  blurb              text,
  -- Who can issue the donor's receipt: nobody (pass-through), an
  -- intermediary such as PayPal Giving Fund, or the payee itself.
  receipting         text NOT NULL DEFAULT 'none' CHECK (receipting IN ('none', 'intermediary', 'self')),
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suggested', 'retired')),
  suggested_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  managed_by_org_id  varchar(50) REFERENCES organizations(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'org') = (org_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payee_org ON payee (org_id) WHERE org_id IS NOT NULL;

INSERT INTO payee (kind, org_id, name, blurb, managed_by_org_id)
SELECT 'org', o.id, o.name, NULL, 'market'
FROM organizations o
WHERE o.id IN ('market', 'ifac', 'inner_group')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS org_beneficiaries (
  org_id     varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payee_id   uuid NOT NULL REFERENCES payee(id) ON DELETE CASCADE,
  position   integer NOT NULL DEFAULT 0,
  added_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, payee_id)
);

-- Listing-level beneficiary (on the variant, which is the priced offer).
ALTER TABLE artwork_variant
  ADD COLUMN IF NOT EXISTS beneficiary_payee_id uuid REFERENCES payee(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS beneficiary_scope text;
ALTER TABLE artwork_variant DROP CONSTRAINT IF EXISTS artwork_variant_beneficiary_scope_check;
ALTER TABLE artwork_variant ADD CONSTRAINT artwork_variant_beneficiary_scope_check
  CHECK (beneficiary_scope IS NULL OR beneficiary_scope IN ('all_proceeds', 'commission'));

-- Order-level: the buyer's support choice for the commission and the
-- resolved beneficiary; line-level amounts.
ALTER TABLE commerce_order
  ADD COLUMN IF NOT EXISTS support jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS beneficiary_payee_id uuid REFERENCES payee(id) ON DELETE SET NULL;
ALTER TABLE commerce_order_line
  ADD COLUMN IF NOT EXISTS beneficiary_payee_id uuid REFERENCES payee(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS beneficiary_share_minor bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processor_fee_minor bigint NOT NULL DEFAULT 0;

-- Ledger: a payee is a fourth party kind.
ALTER TABLE payout_ledger
  ADD COLUMN IF NOT EXISTS party_payee_id uuid REFERENCES payee(id) ON DELETE SET NULL;
ALTER TABLE payout_ledger DROP CONSTRAINT IF EXISTS payout_ledger_one_party;
ALTER TABLE payout_ledger ADD CONSTRAINT payout_ledger_one_party CHECK (
  (party_kind = 'platform' AND party_user_id IS NULL AND party_org_id IS NULL AND party_payee_id IS NULL)
  OR (party_kind = 'user'  AND party_user_id IS NOT NULL AND party_org_id IS NULL AND party_payee_id IS NULL)
  OR (party_kind = 'org'   AND party_org_id IS NOT NULL AND party_user_id IS NULL AND party_payee_id IS NULL)
  OR (party_kind = 'payee' AND party_payee_id IS NOT NULL AND party_user_id IS NULL AND party_org_id IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_payout_ledger_payee
  ON payout_ledger (party_payee_id) WHERE party_payee_id IS NOT NULL;
ALTER TABLE payout
  ADD COLUMN IF NOT EXISTS party_payee_id uuid REFERENCES payee(id) ON DELETE SET NULL;
ALTER TABLE payout DROP CONSTRAINT IF EXISTS payout_one_party;
ALTER TABLE payout ADD CONSTRAINT payout_one_party CHECK (
  (artist_user_id IS NOT NULL)::int + (party_org_id IS NOT NULL)::int + (party_payee_id IS NOT NULL)::int = 1
);

-- ---------------------------------------------------------------------------
-- Lots in a series; series bidding settings; week focus
-- ---------------------------------------------------------------------------
ALTER TABLE auction_lot
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES auction_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lot_number integer,
  ADD COLUMN IF NOT EXISTS closes_at_override timestamptz;
CREATE INDEX IF NOT EXISTS idx_auction_lot_series
  ON auction_lot (series_id, lot_number) WHERE series_id IS NOT NULL;

ALTER TABLE auction_series
  ADD COLUMN IF NOT EXISTS description_html text,
  ADD COLUMN IF NOT EXISTS card jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS close_mode text NOT NULL DEFAULT 'staggered',
  ADD COLUMN IF NOT EXISTS stagger_seconds integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS increment_ladder jsonb,
  ADD COLUMN IF NOT EXISTS soft_close_minutes integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS payment_window_hours integer NOT NULL DEFAULT 72;
ALTER TABLE auction_series DROP CONSTRAINT IF EXISTS auction_series_close_mode_check;
ALTER TABLE auction_series ADD CONSTRAINT auction_series_close_mode_check
  CHECK (close_mode IN ('single', 'staggered'));

ALTER TABLE auction_series_slot
  ADD COLUMN IF NOT EXISTS focus text;

-- ---------------------------------------------------------------------------
-- Bidder registration: phone and a card on file before the first bid.
-- The card is never charged automatically.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bidder_registration (
  user_id                   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id                    varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone                     text,
  stripe_customer_id        text,
  stripe_payment_method_id  text,
  registered_at             timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id)
);

-- ---------------------------------------------------------------------------
-- Marketplace settings, one row per marketplace org, edited in the admin.
-- The ladder is [{"upTo": 9999, "step": 500}, ...] in minor units; the last
-- entry has no upTo.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketplace_settings (
  org_id                  varchar(50) PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  default_commission_rate numeric(5,2) NOT NULL DEFAULT 5.00,
  increment_ladder        jsonb NOT NULL DEFAULT '[
    {"upTo": 9999, "step": 500},
    {"upTo": 49999, "step": 1000},
    {"upTo": 99999, "step": 2500},
    {"upTo": 499999, "step": 10000},
    {"step": 25000}
  ]'::jsonb,
  soft_close_minutes      integer NOT NULL DEFAULT 5,
  payment_window_hours    integer NOT NULL DEFAULT 72,
  updated_by              uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at              timestamptz NOT NULL DEFAULT now()
);
INSERT INTO marketplace_settings (org_id) VALUES ('market') ON CONFLICT DO NOTHING;
