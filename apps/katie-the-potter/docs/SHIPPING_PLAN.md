# Shipping after the sale: plan (Phase 2, EasyPost)

Written 2026-11-07. Design only, nothing here is built yet. Phase 1 (live):
"Buy now" and the cart's "Pay now" send the buyer to Stripe, which collects
email + shipping address; the order page says "you'll get a link to choose a
carrier and pay for the label", and until then Katie arranges it by email.

## The flow

1. **Paid.** The order has a shipping address: from Stripe (Buy now / Pay now)
   or from our checkout form. `confirmOrderPaid` already runs; after it we
   create a `shipment` row (`awaiting_rates`) and email the buyer a link.
2. **Buyer opens `/orders/<id>/shipping`** (same capability as the order page:
   the order's unguessable id, or the signed-in buyer). We build the parcel
   (below), call EasyPost `POST /shipments` (from Katie's ship-from address to
   the buyer's), and show the rates: carrier, service, days, price.
3. **Buyer picks one.** We store the chosen `rate_id` and open a second, small
   Stripe Checkout (one line "Shipping: Canada Post Expedited, 2 to 4 days",
   `metadata.kind = "shipping_label"`, `metadata.shipmentId`). Platform charge;
   the label cost is the platform's cost, so no destination transfer.
4. **Paid (return hop + webhook).** `syncStripeOrder`'s twin for shipments
   confirms the payment, then buys the label: EasyPost `POST /shipments/<id>/buy`
   with the stored rate (and insurance, see below). Store tracking code,
   carrier, label PDF URL, and the cost EasyPost actually charged.
5. **Katie** sees, in /manage/orders: "Label bought: Canada Post, tracking
   1234…", a **Download label (PDF)** button, and "Mark shipped" (existing
   `markOrderFulfilled`, now pre-filled with the tracking number).
6. **Buyer** gets an email with the tracking link; the order page shows it.
   EasyPost's tracker webhook moves the shipment to `in_transit`, `delivered`.

If rates fail (no carrier serves the address, or EasyPost is down), the page
says Katie will arrange it and Katie gets an email: today's fallback.

## The parcel (from the piece)

- Piece size from `artwork.height_cm / width_cm / depth_cm`, weight from
  `artwork.weight_kg`. Today every sample has the size and **none has a weight**.
- **Packed-box rule** (ceramics, double-boxed): box = piece + 8 cm on each
  dimension (4 cm of padding each side), rounded up to the next whole cm;
  weight = piece + 0.6 kg box/padding + 15 % of the piece. A box over
  ~30 kg or 150 cm longest side is "quote by hand".
- Several pieces in one order: one parcel per piece by default (simplest and
  safest for ceramics); combining is a later option.
- Missing size or weight: no rates are shown; the piece form should require
  weight before "put on sale" once Phase 2 is on.

## What we need from Katie (and the owner)

- **Ship-from address** and phone (stored per store, not in code).
- **Default packaging**: confirm the padding rule above, or her real box sizes
  (e.g. small 20×20×20, medium 30×30×30) to snap to.
- **Weights** for every piece (a kitchen scale is enough).
- Which carriers she is willing to drop off at (Canada Post, UPS, Purolator,
  FedEx…) and whether she wants pickup.

## Environment

- `EASYPOST_API_KEY` (test key `EZTK…` for staging and the rehearsal,
  production `EZAK…` on the katie service only), in `docker-compose.yml` like
  the Stripe lines; container recreated, not restarted.
- `EASYPOST_WEBHOOK_SECRET` for the tracker webhook (HMAC header
  `x-hmac-signature`). The webhook route lives on katie
  (`/api/shipping/webhook`): EasyPost events are per-account, not per network,
  so it does not belong in art-auction's Stripe webhook.
- Carrier accounts: start with EasyPost's own (wholesale rates, billed to the
  EasyPost wallet); Katie's own Canada Post contract can be added later.
- The label payment is a normal Stripe Checkout: no new Stripe keys. Its
  webhook event comes through art-auction's existing route, so the shared
  handler needs a `metadata.kind === "shipping_label"` branch (art-auction
  rebuild needed when that lands).

## Tables (migration sketch, `250_order_shipments.sql`)

```sql
CREATE TABLE order_shipment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES commerce_order(id),
  status          TEXT NOT NULL CHECK (status IN ('awaiting_rates','rate_chosen',
                    'awaiting_payment','paid','label_bought','in_transit',
                    'delivered','failed','cancelled','refunded')),
  ship_from       JSONB NOT NULL,          -- snapshot of Katie's address
  ship_to         JSONB NOT NULL,          -- snapshot of the order's address
  parcel          JSONB NOT NULL,          -- {lengthCm,widthCm,heightCm,weightKg,rule}
  easypost_shipment_id TEXT,
  rates           JSONB,                   -- what the buyer was shown, with expiry
  chosen_rate     JSONB,                   -- {rateId,carrier,service,amountMinor,currency}
  insured_minor   INTEGER,
  stripe_session_id TEXT,
  paid_minor      INTEGER,
  label_url       TEXT,
  tracking_code   TEXT,
  tracker_id      TEXT,
  label_cost_minor INTEGER,                -- what EasyPost charged
  refund_status   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON order_shipment(order_id);
-- per store: ship-from + packaging defaults
-- site_config 'shipping:origin' = {name, line1, city, region, postalCode, country, phone}
-- site_config 'shipping:packing' = {paddingCm: 4, boxKg: 0.6, extraPct: 15}
```

## Edge cases

- **International.** Phase 1 lets Stripe accept CA and US only
  (`siteConfig.shipToCountries`). The US needs customs: EasyPost `customs_info`
  with contents "merchandise", HS code 6912 (ceramic tableware) / 6913
  (ornamental ceramics), value = the piece price, origin CA, signer = Katie.
  Wider than CA/US: add countries only once customs forms are tested.
- **Fragile ceramics / insurance.** Offer insurance by default at the piece's
  price (EasyPost insurance ~1 % with a minimum); show it as a line in the
  label payment. Note that carriers often exclude ceramics from breakage
  claims unless packed to their standard: the packing rule matters.
- **Rate expiry.** EasyPost rates are only good for a while and a shipment
  can be re-rated; if the chosen rate is older than ~24 h, or the purchase
  fails, re-rate and ask the buyer to confirm a price change before charging.
  Never buy a label before the label payment is confirmed.
- **Label buy fails after payment.** Retry once; if still failing, refund the
  label payment in full (shared `refundStripeOrder`-like path) and fall back
  to Katie arranging it.
- **Unused labels.** EasyPost refunds an unused label on request (carrier
  dependent, usually within 30 days; Canada Post can take weeks). /manage gets
  "Void label": ask EasyPost to refund, then refund the buyer's label payment.
- **Order refunded or cancelled** before the label: cancel the shipment, no
  label bought; after: void the label as above.
- **Address problems.** Use EasyPost address verification on the buyer's
  address; if it fails, show the suggested correction and let the buyer edit.
- **Pickup instead.** A "Pick up from Katie" option (free) would skip all of
  this; worth offering if she sells locally.

## Open questions for you

1. Who pays for the box and padding: folded into the label price (the weight
   rule above) or a fixed handling fee?
2. Ship to the US from day one, or Canada only until customs is tested?
3. Insurance always on, optional, or off?
4. EasyPost wallet funded by the collective (and the label payment lands on
   the platform account), or should Katie hold the EasyPost account?
5. Should the buyer choose the carrier, or should we show only the cheapest
   and the fastest two options to keep it simple?
6. Phone number: ask for it on Stripe's page (one flag in the new `collect`
   option, `phone: true`)? Some carriers need it for US delivery.
