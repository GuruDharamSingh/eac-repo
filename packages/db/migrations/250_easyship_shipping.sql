-- 250: Easyship shipping (ship-from per maker, packed parcel per artwork,
-- store shipping mode, one shipment row per shipped order). 2026-11-07.
--
-- Decisions (developer, 2026-11-07): ship-from lives on the maker; the
-- collective holds the buyer's shipping money until the seller shows tracking
-- (quote mode) or buys the label itself (platform mode); a network admin sets
-- the mode per store. Docs: docs/reference/commerce.md "Shipping".

-- Where the maker ships from. Commerce `Address` shape plus contact fields
-- Easyship requires: {recipientName, company?, line1, line2?, city, region?,
-- postalCode, country, phone, email}.
ALTER TABLE users ADD COLUMN IF NOT EXISTS ship_from jsonb;

-- The packed parcel, as it goes to the courier (not the artwork's own size):
-- {lengthCm, widthCm, heightCm, weightKg, hsCode?}. NULL = derive from the
-- artwork's dimensions with packing allowance, or arrange with the artist.
ALTER TABLE artwork ADD COLUMN IF NOT EXISTS parcel jsonb;

-- quote    : buyer pays an Easyship quote; seller buys their own label; the
--            collective holds the money until tracking is recorded.
-- platform : buyer pays the quote; the collective buys the label on its
--            Easyship account and keeps the money to pay for it.
-- arranged : no quote; shipping arranged between buyer and seller (the
--            behaviour before this migration).
ALTER TABLE store ADD COLUMN IF NOT EXISTS shipping_mode text NOT NULL DEFAULT 'quote';
ALTER TABLE store DROP CONSTRAINT IF EXISTS store_shipping_mode_check;
ALTER TABLE store ADD CONSTRAINT store_shipping_mode_check
  CHECK (shipping_mode IN ('quote', 'platform', 'arranged'));

CREATE TABLE IF NOT EXISTS shipment (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES commerce_order(id) ON DELETE CASCADE,
  mode              text NOT NULL CHECK (mode IN ('quote', 'platform')),
  provider          text NOT NULL DEFAULT 'easyship',
  -- Easyship ids (platform mode); NULL when the seller shipped on their own.
  provider_shipment_id text,
  courier_service_id   text,
  courier_name      text,
  tracking_number   text,
  tracking_url      text,
  label_url         text,
  -- What the label cost the collective, in the provider's currency (platform).
  label_cost_minor  bigint,
  label_currency    char(3),
  status            text NOT NULL DEFAULT 'created'
                    CHECK (status IN ('created', 'label_ready', 'shipped', 'delivered', 'cancelled', 'failed')),
  provider_payload  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- One live shipment per order; a cancelled or failed one may be replaced.
CREATE UNIQUE INDEX IF NOT EXISTS shipment_one_live_per_order
  ON shipment (order_id) WHERE status NOT IN ('cancelled', 'failed');
CREATE INDEX IF NOT EXISTS idx_shipment_provider_id
  ON shipment (provider_shipment_id) WHERE provider_shipment_id IS NOT NULL;
