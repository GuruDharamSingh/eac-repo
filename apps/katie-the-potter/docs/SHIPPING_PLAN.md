# Shipping after the sale (Easyship quotes): built, quote-only

Planned 2026-11-07 on EasyPost; built the same day on Easyship (the provider
whose tokens are in `.env`), first as **label buying**; the same evening the
owner chose **quote-only** instead:

> "keep it quote only for now, but offering the choice of shipper that they
> follow up with in parallel checkout. no fund production for now from
> platform stripe."

So, as built and deployed (switch **Off** until Katie turns it On):

1. **Quote only.** The platform buys no labels and does not fund the
   production Easyship account. Easyship is used **read-only, for rates**
   (`POST /rates`): no shipment, no label, no money. (Easyship's address
   check is not used: a bad address already comes back as a refused rate
   with the field named, and the buyer can fix it on the page.)
2. **The buyer chooses the shipper.** After the sale, the order page shows
   **Choose shipping**: up to three quotes (cheapest, fastest, best value)
   plus "Show all carriers". They pick one and pay that amount in a
   **second ("parallel") Stripe Checkout** linked to the order.
3. **The shipping money is Katie's**, routed like her sale money, no
   commission: a **destination charge** to her connected account
   (application fee 0) when she has finished Express onboarding
   (`canReceiveDestinationCharge`), otherwise a **platform charge** recorded
   in the ledger as owed to her (one accrual, payable; less the card-fee
   estimate, as `confirmOrderPaid` does for a platform charge: R3, the card
   fee is the maker's; held `no_payout_account` only if she is mid
   onboarding with no eTransfer address). Written in the same transaction
   that marks the shipment paid (`@elkdonis/commerce`
   `recordShippingPaymentPaid` → `accrueShippingPayment`).
4. **The choice travels between the systems:** kept on `order_shipment`
   (`chosen_rate`: Easyship courier service id, courier, service, days,
   amount, currency, quoted-at, insurance, duty estimate; plus the row's own
   parcels, ship-from and ship-to snapshots), on the Stripe line (name and
   description) and in the session metadata, on the buyer's order page
   (e.g. "Shipping paid: Canpar - Ground, est. 1 business day, $38.68. Katie
   will send tracking."), in Katie's email **"Ship this order:
   <service>, paid $X (order)"** (address, parcel box and weight, HS code and
   declared value for the US, insurance, how to buy the label) and on a
   **Ship this** card in /manage/orders with a **Carrier + Tracking number →
   Mark shipped** form. Mark shipped sets the shipment `in_transit`, marks
   the order shipped and emails the buyer the tracking (with a link for
   Canada Post, Purolator, UPS, FedEx, DHL, Canpar and USPS).
5. **Insurance is Katie's setting** (she buys the label): "I'll insure
   parcels" (default on) folds Easyship's insurance fee into every quote;
   "Let buyers choose whether to insure" (default off) shows a tick box
   instead. Off: quotes without insurance, nothing said.
6. **Quote vs label price:** Katie is told (on /manage/shipping, the card and
   the email) that the label she buys may differ a little from the quote;
   she absorbs small differences; buyers are never charged again.

Easyship API **v2024-09** (the latest, per developers.easyship.com, read
2026-11-07). Hosts `public-api-sandbox.easyship.com` (token `sand_…`) and
`public-api.easyship.com` (token `prod_…`), `Authorization: Bearer`.

## The switch: Off, Test, On

`site_config` (org `katie-the-potter`) `shipping:mode` = `{ mode }`, set on
**/manage/shipping**. Katie sees three buttons:

| Button (stored) | Who sees "Choose shipping" | Easyship | Stripe |
|---|---|---|---|
| **Off** (`off`, default) | nobody: "Katie will be in touch to arrange it", as before | never called | — |
| **Test** (`quote_test`) | editors of the site only, on any order with an address (paid or not, a rehearsal) | sandbox token, quotes only | never: **Choose (test: no payment)** skips payment and the ledger |
| **On** (`quote`) | the buyer, once the order is paid | production token, **quotes only** (read-only, no money) | the parallel Checkout, Katie's money |

The token is picked per call from the mode (`src/lib/shipping/easyship.ts`,
`settings.ts accountOf`); a Test call cannot reach production, and a token of
the wrong prefix is refused. **On** can only be chosen by the shop's owner,
once the ship-from address is saved and a quote from exactly that address has
worked (press **Try it** once), and when the production token is set.

Developer-only: `test` / `live` (label buying, below) count only when the
container has `SHIPPING_LABEL_BUYING=on` (not set). Without it a stored
`test`/`live` reads as Off and the buttons are not shown; /manage/shipping
says "Label buying — not enabled".

## The flow (On)

1. **Paid** order → "What happens next" shows **Choose shipping**.
2. `/orders/<id>/shipping` (the order page's access rule): parcels from the
   pieces, `POST /rates` (production, read-only), insured for the pieces'
   price; kept on an `order_shipment` row (`rated`), reused 30 minutes.
3. The buyer picks; the server re-checks the price they saw and re-rates when
   the quote is older than 30 minutes (any change is shown and must be
   confirmed; nothing charged). `chosen_rate` gets `flow: "quote"` and the
   quote's facts. **No Easyship shipment is made.**
4. **Pay for shipping** → `startShippingPayment`: the route
   (`resolveShippingPaymentRoute`: the order's single maker; destination only
   when she can take one) and a Checkout with `metadata.kind =
   "shipping_payment"`, `shipmentId`, `orderId`, `route`, `payTo`,
   `destination`, `courierServiceId`, `courier`, `service`, `estDays`,
   `amountMinor`, `currency`, `quotedAt`, `insured`, `parcel`,
   `shipToCountry`, `quoteSource`; one line "Shipping: <service>, <days>
   (insured)" with a description (order, "Katie packs and ships it, then
   emails you the tracking", the quote time, the parcel). Row →
   `awaiting_payment`.
5. **Back from Stripe** (`/api/shipping/return`): `syncShippingPayment`
   retrieves the session and hands it to `applyShippingPaymentSession` (the
   one path the webhook uses too): paid → `recordShippingPaymentPaid`
   (row `paid` + the ledger, one transaction, once only), then `advance`
   emails Katie "Ship this order" once (`ship_this_notice` in the row's
   events). Then the buyer sees "Shipping paid … Katie will send tracking".
6. **Katie** buys the label herself (her own Easyship account, the
   carrier's site or the counter), types carrier + tracking on the Ship-this
   card → **Mark shipped**: row `in_transit`, order `fulfilled` (note
   "Tracking …"), buyer emailed the tracking.

A buyer who leaves Stripe's page can **Continue to payment** or **Choose a
different option** (the session is expired). Paid and closed the tab: the
webhook records it once art-auction is rebuilt; until then the next look at
/manage/orders or the shipping page does (and sends Katie's email).

## Parked: label buying (not enabled)

The first design, kept and not deleted, behind `SHIPPING_LABEL_BUYING=on`
(not set): the collective bought each label on its own Easyship account (a
platform charge, `metadata.kind = "shipping_label"`, no ledger entry). The
shared webhook still records that kind exactly as before. What it did:

1. **Paid.** The order page's "What happens next" shows **Choose shipping**
   (Off: the old sentence, unchanged).
2. **`/orders/<id>/shipping`** (the order page's own access rule:
   the signed-in buyer, the store team, an admin, or the unguessable id).
   The parcel is built from each piece (below) and Easyship
   `POST /rates` is asked for Katie's ship-from → the order's address,
   insured for the pieces' price. Rates are kept on an `order_shipment` row
   (`rated`) and reused for 30 minutes.
3. **Up to three options**: the cheapest, the fastest and Easyship's best
   value (`value_for_money_rank` 1), tagged; **Show all carriers** for the
   rest. **Insure the parcel** is ticked; unticking takes off the
   `insurance_fee` Easyship quoted. US destinations show the estimated
   import duty and tax (DDU: the buyer pays them at the door).
4. **Pay for shipping.** The server re-checks the price the buyer saw (a
   rate older than 24 h is re-rated), makes the Easyship shipment for that
   courier with **no label** (free), and charges what Easyship says that
   shipment costs. Any price change is shown and has to be confirmed again;
   nothing is charged. Then a second Stripe Checkout: one line
   "Shipping: Canpar - Ground, 1 business day (insured)", a **platform
   charge** (no destination, no application fee), `metadata.kind =
   "shipping_label"`, `metadata.shipmentId`, `metadata.orderId`.
5. **Back from Stripe** (`/api/shipping/return?shipment=<id>`): the shared
   sync path (`syncShippingLabelPayment`) reads the session; only when it is
   paid does the row move to `paid`, and only then is the label bought:
   `POST /shipments/{id}/label` (PDF via URL, 4×6), claimed atomically
   (`paid → buying`) so it is never bought twice. Stored: carrier, tracking
   number and page, label URL, and what Easyship charged
   (`label_cost_minor`).
6. **Label fails:** one retry; then the label payment is refunded in full
   through the provider's refund (the same path card orders use), the
   Easyship shipment is cancelled, the buyer sees "Katie will arrange
   shipping" and Katie gets an email. Today's fallback.
7. **Katie**, in /manage/orders: "Label bought: <carrier>, tracking …",
   **Download label (PDF)** (editors only, `/api/shipping/label/<id>`),
   what the buyer paid and what the label cost, and **Mark shipped
   (tracking filled in)**. Emails (SendGrid, already on this service): the
   buyer gets the tracking link, Katie gets "Label ready". Test mode sends
   no email; the row's event log says what would have gone, and to whom.
8. **Tracking:** Easyship's webhook (`/api/shipping/webhook`) moves the row
   to `in_transit` and `delivered` (never backwards) and keeps Easyship's
   words ("In Transit to Customer"); the buyer's pages show them.

A buyer who leaves Stripe's page can **Continue to payment** or **Choose a
different option** (the open session is expired and the Easyship shipment
deleted). A buyer who pays and closes the tab is caught up on the next look
at /manage/orders or the order's shipping page (the webhook records the
payment once art-auction is rebuilt; see below).

## The parcel (`src/lib/shipping/parcel.ts`)

- Size from `artwork.height_cm / width_cm / depth_cm` (depth defaults to the
  width: a round pot), weight from **`artwork.weight_kg`** (new field on the
  piece form, "Weight (kg)", next to the size).
- **Packed box** (settings `shipping:packing`, defaults): box = piece + 4 cm
  padding each side, rounded up; weight = piece + 0.6 kg box + 15 % of the
  piece. The box is in the price this way: **no handling fee**.
- One parcel per piece. Over 30 kg or 150 cm: "Katie will arrange it".
- Missing size or weight: no rates; "Katie will be in touch". While the
  mode is Test or Live, **putting a piece on sale needs its height, width and
  weight** (a friendly message says so). The sample pieces have no weight
  and were not changed; Try it takes a typed weight for them.
- **Customs** (every rate carries items; the US needs them): HS **691200**
  (ceramic tableware) or **691390** (ornamental: vase, sculpture…, from the
  title or medium), declared value = the piece's price, origin CA,
  description "Handmade ceramic: <title>". Easyship's `category` is not
  needed when an HS code is given (`home_decor` would be the slug).
- Receiver phone and email: the buyer's; with none, the studio's (the
  carrier calls Katie). Stripe's page now also asks Buy now / Pay now buyers
  for a phone (`collect.phone: true`); our checkout form already had one.

## Data

- **Migration 251** `order_shipment` (one row per attempt; `mode` test or
  live; statuses `rated → awaiting_payment → paid → buying → label_pending /
  label_bought → in_transit → delivered`, or `failed`, `refunded`,
  `cancelled`; snapshots of ship-from, ship-to and parcels; the rates shown;
  the chosen rate; insurance; Easyship and Stripe ids; tracking; label URL
  and cost; an event log). At most one label in flight per order and mode.
  Quote-only uses the same table, no new migration: `rated →
  awaiting_payment → paid → in_transit` (Katie's tracking), `chosen_rate`
  carries `flow: "quote"`, `quotedAt`, `insured`, `insuranceMinor`,
  `dutyMinor`; the events log `payment_started` (route, payTo), `paid`,
  `ledger` (entry ids, payout id, route, amount after fee),
  `ship_this_notice`, `shipped_by_katie`, and in Test `email_skipped_test`.
- Ledger (quote-only): `payout_ledger` rows with `order_id`, no
  `order_line_id`, note "Shipping paid by the buyer (<service>) …"; a
  destination charge also writes a `payout` row (method stripe).
- `site_config`: `shipping:mode`, `shipping:origin` (name, studio, address,
  phone, email, and when a quote from it last worked), `shipping:packing`,
  `shipping:insurance` (`{insure, buyerChooses}`, default on / off).
- Not used here: migration 250 (art-auction's Easyship model, a different
  flow: the quote rides on the order before payment). Applied with 251 on
  2026-11-07 because the runner applies everything pending.

## Code

- `src/lib/shipping/`: `easyship.ts` (the client), `settings.ts`,
  `parcel.ts`, `rates.ts`, `shipments.ts` (the flow), `access.ts`,
  `actions.ts` (server actions), `notices.ts` (emails), `webhook.ts`.
- Pages: `src/app/manage/shipping/page.tsx` (+
  `components/manage/shipping-forms.tsx`: mode, ship-from, packing,
  insurance, Try it), `src/app/orders/[id]/shipping/page.tsx`
  (+ `components/shipping-picker.tsx`), `src/app/manage/orders/page.tsx`
  (+ `components/manage/ship-this.tsx`, the Ship-this card); routes
  `src/app/api/shipping/{return,webhook,label/[id]}`.
- Quote-only in `shipments.ts`: `chooseRate({ flow: "quote" })`,
  `shippingPaymentInput` (everything the Checkout carries, pure),
  `startShippingPayment`, `markAwaitingPayment`, `markQuoteTestPaid`,
  `ensureShipThisNotice`, `recordKatieShipped`, `trackingUrlFor`;
  `notices.ts` `composeShipThis` / `composeTracking`; `actions.ts`
  `saveInsuranceAction`, `markShippedWithTrackingAction`.
- Shared, additive: `packages/checkout/src/server/shipping-label.ts`
  (re-exported from `@elkdonis/checkout/stripe`): quote-only
  `SHIPPING_PAYMENT_KIND`, `buildShippingPaymentSessionParams`,
  `startShippingPaymentCheckout`, `resolveShippingPaymentRoute`,
  `shippingRouteFor`, `applyShippingPaymentSession` (the single recorder for
  return hop, webhook and checks), `syncShippingPayment`,
  `isShippingPaymentSession` (both kinds; `isShippingLabelSession` is the
  same test); the parked label functions unchanged. `handleStripeWebhook`'s
  shipping branch is unchanged code (it now matches both kinds through the
  same `isShippingLabelSession`), only its comment changed.
  `packages/commerce/src/server/shipping-label.ts`: new
  `recordShippingPaymentPaid` (paid + ledger in one transaction, optional
  `tx`) and `accrueShippingPayment` (the ledger rows, mirroring
  confirmOrderPaid, no commission); `recordShippingLabelPaid`,
  `recordShippingLabelSessionExpired`, `sendCommerceNotice` unchanged.
  Every other session is unchanged.
- Scripts: `scripts/shipping-quote-check.ts` (quote-only: both routes'
  params built not sent; the payment simulated with a fake session through
  the return hop's path; emails composed; snapshot; cleanup),
  `scripts/shipping-label-params.ts` (the parked label session's params),
  `scripts/shipping-rehearsal.ts` (status, signed webhook simulation,
  sandbox cleanup).

## Environment

`docker-compose.yml`, katie service: `EASYSHIP_SANDBOX_TOKEN`,
`EASYSHIP_PRODUCTION_TOKEN`, `EASYSHIP_WEBHOOK_SECRET`,
`EASYSHIP_SANDBOX_WEBHOOK_SECRET` (all `${…:-}`). Optional
`EASYSHIP_COMPANY_ID` (checked against the webhook token's claim when set).
`SHIPPING_LABEL_BUYING` (developer flag for the parked label modes) is not
in `docker-compose.yml` and not set; leave it so.

**Webhook** (not set up yet): Easyship dashboard → Connect → Webhooks →
add `https://pottery.arts-collective.com/api/shipping/webhook` with the
events *Changing tracking status*, *Creating a shipment label*, *Failing to
create a label*, *Cancelling a shipment*; put its secret key (`webh_…`) in
`.env` as `EASYSHIP_WEBHOOK_SECRET` and recreate the service. Without it,
tracking is what the label purchase recorded, and the route answers 503.
Easyship signs with a JWT (HS256, `X-EASYSHIP-SIGNATURE`) whose claims do
not cover the body, so the route only ever moves a shipment we created
forward and never buys, refunds or cancels.

## Checked: quote-only (2026-11-07, evening)

- Type-checks exit 0: katie-the-potter, art-auction, artdirect, sunjay,
  elktours, innergathering, hidden-enneagram, arts-collective, ifac,
  danamccool. elastrocal: the same 3 errors as before (not touched).
- Signed in as the placeholder owner, sandbox only: ship-from saved, **Test**,
  Try it (Tenmoku tea bowl, typed 0.5 kg → 20×20×16 cm, 1.18 kg: Canpar
  Ground $38.68 insured, Express $39.80, 1 more), an eTransfer test order
  ART-20261107-6749 (signed out, Montréal), Choose shipping (insurance
  "included", Test button, phone width without overflow).
- `scripts/shipping-quote-check.ts params`: the parallel Checkout's params
  for both routes, built not sent (28 checks): onboarded stand-in →
  `transfer_data.destination` = her account, no `application_fee_amount`;
  as she is (eTransfer, no Stripe account) → platform charge; both carry
  `kind=shipping_payment`, the quote, payTo, parcel, one line with
  description, return URLs.
- `… pay`: the payment simulated with a fake session object (not Stripe)
  through `applyShippingPaymentSession` and `advance`, the return hop's own
  path (16 checks). Destination route (rolled back): accrual +3868 and payout
  −3868 to Katie plus a `payout` row (stripe, sent). Platform route
  (committed): shipment paid, one accrual **3726 = 3868 − 142 card-fee
  estimate**, payable, owed to Katie; a second delivery records nothing; a
  foreign session or kind is ignored; "Ship this" email composed and logged
  once.
- UI after "paid": shipping page "Shipping paid", the order page line, the
  /manage/orders Ship-this card; tracking typed (Canada Post
  TESTQUOTE1234567) → Mark shipped → "Shipped", buyer page "On its way",
  buyer's tracking email composed and logged.
- Cleanup: 1 ledger entry and 1 test shipment row deleted; `payout_ledger`
  (2 rows), `payout` (1 row) fingerprints identical before and after; order
  cancelled (piece available, no reservation, still no weight), shipping
  Off, ship-from cleared, no insurance setting saved, session deleted.
- Not checked: a real Stripe session (live keys), a production quote in this
  round, the US customs lines on a real US order (sandbox has no CA → US
  couriers; the card and email print HS code and declared value for US
  addresses).

## Checked: label buying (2026-11-07, morning; now parked)

- Sandbox, Canada, signed in end to end: Try it, an eTransfer test order,
  Choose shipping (Canpar Ground $38.68 insured, $37.73 not; Express;
  Select), Buy test label (label PDF, tracking `TEST12345678`), the line in
  /manage/orders, a signed webhook simulation (refusals, In transit →
  Delivered, never backwards), cancel with Easyship.
- Easyship refuses a contact name over 22 characters (not in the spec):
  the ship-from name is limited to 22, a buyer's name is shortened.
- Sandbox, US: **no couriers at all** for CA → US (any HS code, category,
  phone; Easyship says the sandbox has a reduced courier slate). One
  read-only **production quote** CA → US (no shipment, no label, no
  money) returned DHL Express Worldwide, FedEx Ground and FedEx
  International Connect Plus with insurance fees and duty estimates, so the
  request shape is right for the US.
- Stripe: the label session's params built and not sent (platform charge,
  one line, metadata, URLs), Buy now now asks for a phone, existing sessions
  unchanged.

## Open

- **art-auction rebuild** (it runs the network's Stripe webhook) so
  shipping payments are recorded by the webhook too (`shipping_payment`
  and the ledger). Until then katie's return hop and the next visit to
  /manage/orders or the order's shipping page do it. The webhook as it runs
  today does no harm with a shipping session: its order branch finds the
  order already paid and skips.
- The production Easyship account is used for quotes only; it needs no
  balance. Its Shipping rules (dashboard) can hide couriers Katie doesn't
  want offered.
- Katie's own label may cost more or less than the quote; she absorbs it
  (no re-charge). If differences turn out large, a re-charge or a margin
  can come later.
- Refund of a shipping payment (buyer cancels before she ships): not built;
  an admin refunds it in Stripe and records a ledger reversal by hand.
- Several pieces ship as several parcels; combining into one box is not
  built. Pickup from Katie (free) is not offered.
- Parked label buying: the open items it had (fund the account, "Void
  label", cancel a label after a refund) apply only if it is ever enabled.
