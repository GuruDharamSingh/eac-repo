-- 251: shipping chosen and paid AFTER the sale (katie-the-potter, Easyship).
-- 2026-11-07. Docs: apps/katie-the-potter/docs/SHIPPING_PLAN.md.
--
-- A different model from migration 250 (art-auction: the buyer picks a quote
-- before paying and it rides on the order's own total). Here the order is
-- paid first; the buyer then opens /orders/<id>/shipping, picks a rate and
-- pays for the label in a SECOND Stripe Checkout (metadata.kind =
-- "shipping_label", a platform charge); the label is bought on the
-- collective's Easyship account only after that payment is confirmed.
--
-- One row per attempt. `mode` says which Easyship account it lives on:
-- 'test' = sandbox (editors only, no real money), 'live' = production.
-- Per-store settings stay in site_config (org katie-the-potter):
--   shipping:mode    {mode: off|test|live}
--   shipping:origin  {name, company, line1, line2, city, region, postalCode,
--                     country, phone, email, checkedAt?, checkedHash?}
--   shipping:packing {paddingCm, boxKg, extraPct}

CREATE TABLE IF NOT EXISTS order_shipment (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              uuid NOT NULL REFERENCES commerce_order(id) ON DELETE CASCADE,
  mode                  text NOT NULL CHECK (mode IN ('test', 'live')),
  status                text NOT NULL DEFAULT 'rated' CHECK (status IN (
                          'rated',            -- rates shown, nothing chosen yet
                          'awaiting_payment', -- Easyship shipment made, Stripe session open
                          'paid',             -- label payment confirmed, label not bought yet
                          'buying',           -- a process has claimed the label purchase
                          'label_pending',    -- bought, label document not ready yet
                          'label_bought',
                          'in_transit',
                          'delivered',
                          'failed',           -- label could not be bought (payment refunded)
                          'cancelled',
                          'refunded')),
  ship_from             jsonb NOT NULL,          -- snapshot of shipping:origin
  ship_to               jsonb NOT NULL,          -- snapshot of the order's address
  parcels               jsonb NOT NULL,          -- [{artworkId,lengthCm,widthCm,heightCm,weightKg,rule}]
  rates                 jsonb,                   -- what the buyer was shown
  rated_at              timestamptz,
  chosen_rate           jsonb,                   -- {courierServiceId,courier,service,minDays,maxDays,amountMinor,currency}
  insured               boolean NOT NULL DEFAULT false,
  insurance_minor       integer,
  amount_minor          integer,                 -- what the buyer pays for shipping
  currency              char(3),
  easyship_shipment_id  text,
  stripe_session_id     text,
  stripe_payment_intent text,
  paid_minor            integer,
  paid_at               timestamptz,
  courier_name          text,
  tracking_number       text,
  tracking_url          text,
  tracking_status       text,                    -- Easyship's words ("In Transit to Customer")
  label_url             text,
  label_cost_minor      integer,                 -- what Easyship charged the collective
  label_currency        char(3),
  label_bought_at       timestamptz,
  refund_reference      text,
  error                 text,
  events                jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by            uuid REFERENCES users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_shipment_order ON order_shipment (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_shipment_easyship ON order_shipment (easyship_shipment_id)
  WHERE easyship_shipment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_shipment_session ON order_shipment (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
-- At most one label in flight or bought per order and mode.
CREATE UNIQUE INDEX IF NOT EXISTS order_shipment_one_live
  ON order_shipment (order_id, mode)
  WHERE status IN ('awaiting_payment', 'paid', 'buying', 'label_pending', 'label_bought', 'in_transit', 'delivered');
