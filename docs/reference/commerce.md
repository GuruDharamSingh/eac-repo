# Commerce, marketplace and payments

Covers stores, artwork, orders, settlement, the payout ledger, agreements,
Stripe (hosted Checkout + Connect Express) and paid workshops. The reference
store app is `apps/art-auction` (port 3009, public at `market.arts-collective.com`)
on `packages/commerce`, `packages/payments` and `packages/checkout`.
Stripe has been in live mode since 2026-09-18.
Last verified: 2026-09-23 (code read, schema and row counts queried; no Stripe
API call made).

## Current state

### Packages

| package / subpath | holds |
|---|---|
| `@elkdonis/commerce/types` | domain types (`Store`, `Artwork`, `Order`, `PayoutIdentity`, …) |
| `@elkdonis/commerce/queries` | reads: `listArtworks`, `getStoreByHandle`, `getStoreForUser(userId, orgId?)`, `listStoresForUser`, `getStoreShowcaseForUser`, `getOrderLines`, … |
| `@elkdonis/commerce/server` | writes: stores (`applyForStore`, `openOrgStore`, `setPayoutIdentity`), artwork, orders, auctions, `createThreadOrder` |
| `@elkdonis/commerce/settlement` | `resolveSettlement` (`packages/commerce/src/server/settlement.ts:77`) |
| `@elkdonis/commerce/ledger` | `payout_ledger` reads/writes (`packages/commerce/src/server/ledger.ts`) |
| `@elkdonis/commerce/links` | `marketplaceLinks`, `storeEntry` (`packages/commerce/src/links.ts:70`, `:139`) |
| `@elkdonis/commerce/payout-rails` | which payout rail a person can use, by country (`packages/commerce/src/payout-rails.ts`) |
| `@elkdonis/commerce/components` + `/commerce.css` | `ProductCard`, `ProductGrid`, `StoreShowcase`, `PayoutSetup`, `EarningsStatement`, older Tailwind components |
| `@elkdonis/payments` (`/stripe`, `/etransfer`) | provider registry; `packages/payments/src/providers/stripe.ts` is the only file that talks to Stripe (`stripe@^22.6.1`) |
| `@elkdonis/checkout/stripe` (not `/server`) | app-facing glue: `startStripeCheckout`, `handleStripeWebhook`, `syncStripeOrder`, `startStripeOnboarding`, `startPayoutsFor`, `refreshStripeAccountStatus`, `refundStripeOrder` (`packages/checkout/src/server/stripe.ts`) |
| `@elkdonis/services/agreements` | `resolveOrgShare` and the agreement lifecycle (`packages/services/src/agreements.ts:365`) |

### Stores and ownership (migrations 092, 094, 095, 112)

- `marketplace_artists` was renamed to `store` (094). Primary key is a
  surrogate `id`. Owner is polymorphic: `owner_user_id` xor `owner_org_id`
  (`CHECK store_one_owner`). `owner_kind` is a generated column
  (`CASE WHEN owner_org_id IS NOT NULL THEN 'org' ELSE 'user' END`), verified
  via `information_schema.columns.is_generated = 'ALWAYS'`.
- `store.org_id` is the marketplace the store trades in; `owner_org_id` is who
  owns it. Partial unique indexes `store_user_owner_per_org` and
  `store_org_owner_per_org` allow one store per owner per marketplace.
- 2026-09-23: 5 stores, all `org_id = 'market'` (4 user-owned, 1 org-owned),
  all `active`. `getStoreForUser` takes the org as optional, so org sites
  display a person's store (`StoreShowcase`) rather than owning one.
- `store_member (store_id, user_id, role)` is the store's roll
  (`owner · manager · staff`), separate from `user_organizations`. Money
  actions on an order need `manager`+ via `canActForOrder(..., { minRole })`
  (`packages/commerce/src/server/access.ts:53`).
- An org can open a store only once a real person holds `owner` in it
  (`canOrgSell`).
- 095: `artwork.store_id` NOT NULL (seller), `artwork.artist_user_id` nullable
  (maker), `cart.store_id` (one cart per store, enforced in `addToCart`),
  `commerce_order.store_id` (NULL for thread orders).
- 112 (`112_store_presentation.sql`): `store_presentation` lets a front show
  another store's piece. `?via=<storeId>` → `cart_line.via_store_id` →
  `commerce_order_line.presented_store_id`; the presenting front's owning org
  becomes the split counterparty. Number 112 is shared with
  `112_forum_interactions.sql`; both are applied.
- Deprecated `store` columns still present and ignored: `payout_email`,
  `commission_rate`, `display_name`, `headline`, `city`, `photo_url`.
  Identity comes from the owner's `users` row.
- `getStoreByHandle` (`packages/commerce/src/queries/index.ts:621`) resolves a
  person slug, org slug or raw id, comparing uuid columns only for
  uuid-shaped handles.

### Artwork is its own table, not a thread

`artwork` (042/094), `artwork_variant` (price, currency, inventory),
`artwork_media`, `auction_lot`, `bid`. Live `threads.kind` values on
2026-09-23: document, idea, meeting, pigeon, post, service, wiki_page,
workshop, writing — no artwork, no product. Decided 2026-09-17 to keep artwork
out of `threads`: ten tables reference `artwork`/`artwork_variant`, the status
vocabularies differ (`draft|available|reserved|sold|archived`), and a new
thread kind is opt-out on every feed/forum/search surface. If a piece needs
feed presence, use a derived mirror thread (the `kind='document'` pattern,
migration 133). The shared composer is `ArtPieceComposer` in
`@elkdonis/cms-ui/compose` (`packages/cms-ui/src/compose/ArtPieceComposer.tsx`).

A variant priced 0 is "price on request": it publishes, shows, and cannot be
added to a cart (`packages/commerce/src/server/index.ts:176`).

### Vocabulary

Canonical terms are in `docs/archive/MARKETPLACE_NAMING.md` (2026-09-08; still
accurate except where noted below). Short form:

| use | not |
|---|---|
| store (table), front (its role in the money model) | shop, seller profile, `marketplace_artists` |
| artwork (code) / piece (copy) | product (reserved for purchasable threads), item |
| maker (code) — column is still `artist_user_id` | artist in new identifiers |
| listing = `artwork.status = 'available'` | a `listing` table |
| variant, lot, bid, hammer, reserve, settle, withdraw | SKU as the noun |
| rail: `etransfer` · `stripe` · `manual` | |
| maker share / org share — columns `artist_share_minor` / `gallery_share_minor` | gallery share in new code |
| amounts in integer minor units (`*_minor`) | floats, major units in tables |

Deprecated function names still exported for old callers: `createServiceOrder`
(→ `createThreadOrder`, `packages/commerce/src/server/service-orders.ts:255`),
`createEtransferOrder` / `confirmEtransferReceived` (→ `createOrderFromCart` /
`confirmOrderPaid`), `MarketplaceArtist` and friends (→ `Store`),
`ArtworkCard` / `ArtworkGrid` (→ `ProductCard` / `ProductGrid`).

Correction to the naming doc: `/artworks` now permanently redirects to `/`,
which is the catalogue (`apps/art-auction/src/app/artworks/page.tsx`).

### Payee model (migrations 096–098)

- The maker is the payee. A store is a front: `commerce_order.store_id` and
  `commerce_order_line.presented_store_id` record through whom, never to whom.
- Payout identity lives on `users`: `payout_email`, `payout_method`,
  `stripe_account_id`, `stripe_onboarded_at` (096), plus `users.country`
  (from 084) which selects the rail. A person onboards once for every front.
- Orgs never hold connected accounts. An org's share is a `payout_ledger`
  balance inside the host (platform) account. 096 dropped the Stripe columns
  094 had put on `store`.
- An org takes a cut only under an accepted agreement (`org_agreements`,
  `org_agreement_acceptances`). `resolveOrgShare`
  (`packages/services/src/agreements.ts:365`) selects non-revoked acceptances
  for that org regardless of agreement status, ordered by
  `revenue_share_percent ASC`: an acceptance binds to its version until the
  person accepts another or withdraws; retiring a version stops only new
  acceptances; the smallest cut wins when several apply. No acceptance → 0%.
- Work with no maker earmarks 100% to the org; the buyer pays the host account.
- `resolveSettlement` (`settlement.ts:77`) is the single answer for every rail
  (cart, thread orders). It throws when a maker has neither `payout_email` nor
  `stripe_account_id` rather than routing their money to the host.
  `HOST_PAYOUT_EMAIL` reads `ART_AUCTION_GALLERY_PAYOUT_EMAIL` (`settlement.ts:33`).
- Order lines record their own split: `agreement_id` (NULL = nothing
  authorised a cut), `org_share_percent`, `payee_org_id`, `presented_store_id`.
- 097 dropped `threads_kind_check`; `PURCHASABLE_THREAD_KINDS`
  (`service-orders.ts:33`) = service, workshop, event, product.

### Ledger (098)

`payout_ledger` is append-only. Party is polymorphic: `party_kind`
`user | org | platform` (`CHECK payout_ledger_one_party`). Entry types:
`accrual · release · payout · adjustment · refund`. Hold reasons:
`no_payout_account · below_threshold · org_unowned · dispute_window`
(`ledger.ts:21-27`). Balances are summed, never stored. Guards:
`payout_ledger_one_accrual_per_line` (partial unique index — re-confirming
cannot pay twice) and `payout_ledger_release_is_zero`. A release is a new
zero-amount row pointing at the accrual (`releases_entry_id`).

Holds release on two triggers only: `setPayoutIdentity` calling
`releaseOnPayoutAccountReady` when `stripe_onboarded_at` is set (releases
`no_payout_account` only), and a network admin at arts-collective
`/hub/admin/ledger` (`releaseHold`). Reaching a threshold or an org being
claimed does not release. Agreements console: arts-collective
`/hub/agreements`. The `payout` table records transfers that happened;
`payout.artist_user_id` is nullable with `party_org_id` beside it.

### Orders and checkout

`packages/commerce/src/server/orders.ts`: `createOrderFromCart` (either rail,
`:373`), `switchOrderToEtransfer`, `recordStripeCheckout`, `confirmOrderPaid`
(`:543`), `cancelOrder`, `releaseExpiredOrders` (lazy, from studio/admin/lots),
`markOrderFulfilled`, `refundOrder`. Auctions: `createLot`, `cancelLot`,
`settleExpiredLots` in `auctions.ts`; migration 111 replaced the UNIQUE on
`auction_lot.artwork_variant_id` with partial unique index
`auction_lot_one_open_per_variant` (scheduled/live only), so a passed piece can
be relisted.

Order status (CHECK on `commerce_order`): `draft · pending_payment ·
awaiting_etransfer · payment_received · paid · fulfilled · completed ·
cancelled · refunded`. `confirmOrderPaid` only moves an order from
`awaiting_etransfer | payment_received | pending_payment` to `paid`, which
makes it idempotent: the webhook and the return hop both call it; the second
is refused.

What `confirmOrderPaid` records per rail: eTransfer → maker accrual + payout
netting to zero; Stripe destination charge → accrual + payout; Stripe platform
charge → maker accrual payable, or held `no_payout_account` when the maker has
a started-but-unfinished Stripe account and no eTransfer address. Org shares
accrue held under `dispute_window` (`orders.ts:690`).

`/orders/[id]` in art-auction is the single pay-for-this surface (cart order,
auction win, rail switch). Card charges above `CARD_CHARGE_CEILING_MINOR`
(99,999,999) raise `CardCheckoutRefused`; the buyer is sent back to the order
page to pay by eTransfer (`packages/checkout/src/server/stripe.ts:94-110`).

### Paid workshops (2026-09-19)

- innergathering's `POST /api/threads/[id]/rsvp`
  (`apps/innergathering/src/app/api/threads/[id]/rsvp/route.ts:135-180`): a
  thread with price > 0 creates a `createThreadOrder({ paymentMethod: 'stripe',
  kinds: ['workshop','event'] })` and returns a Checkout URL. No RSVP row is
  written there. Sliding scale: buyer chooses in `[price_sliding_min, price]`,
  validated in commerce.
- `confirmOrderPaid` inserts the `thread_rsvps` row in the same transaction
  for `kind IN ('workshop','event')` (`orders.ts:713-719`). Payment grants
  the seat.
- The guest route `apps/innergathering/src/app/api/rsvp/route.ts:71-79` returns
  409 for a priced thread: `thread_rsvps.user_id` is NOT NULL, so guests cannot
  buy.
- Return hop: `apps/innergathering/src/app/api/checkout/return/route.ts` calls
  `syncStripeOrder` then redirects to a same-site path only (open-redirect
  guard).
- Service bookings on hidden-enneagram still call the deprecated
  `createServiceOrder` (eTransfer). `apps/inner-gathering` (hyphenated, being
  retired) still has its own workshop join route.
- Verification script: `packages/commerce/scripts/probe-paid-workshop.mts`.

### Stripe

- Hosted Checkout only; card data never touches an app.
- Routing (`resolveDestination`, `packages/checkout/src/server/stripe.ts:61`):
  a destination charge to the maker's connected account, with the summed org
  share as `application_fee_amount`, only when every line has the same maker
  and that maker `canReceiveDestinationCharge` (account id and
  `stripe_onboarded_at` both set). Otherwise a platform charge, and the ledger
  records what is owed. The platform fallback is required: Express onboarding
  is KYC and some payees never finish it.
- Express accounts are created with `business_type: "individual"` and the
  person's country (`packages/payments/src/providers/stripe.ts:252-261`).
  `startPayoutsFor` refuses to create an account until a country is on file.
  `payout-rails.ts` limits Stripe to `STRIPE_TRANSFER_COUNTRIES` (read from
  Stripe's `country_specs/CA` on 2026-09-19) and eTransfer to CA.
- The Stripe-side business model is "marketplace" (user choice, 2026-09-17).
- 2026-09-23 `.env` holds a live restricted secret key (`rk_live_` prefix) in
  `STRIPE_SECRET_KEY`, a live `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
  and `STRIPE_CONNECT_WEBHOOK_SECRET` (prefixes checked only).
- Connected accounts in the DB on 2026-09-23: 3 `users` rows with
  `stripe_account_id`, 2 stamped `stripe_onboarded_at` (both 2026-09-20).
  Orders: 1 paid eTransfer (2026-07-28), 1 paid Stripe and 2 cancelled Stripe
  (2026-09-21).

Env reach (`docker-compose.yml`): `STRIPE_SECRET_KEY` goes to innergathering
(`:982`), ifac (`:1222`, plus publishable) and art-auction (`:1330-1335`, all
four). A new app offering card payments or payouts needs its own lines, and the
container must be recreated, not restarted, to see new env.

### Webhooks

- One route serves the network: art-auction `POST /api/stripe/webhook`
  (`apps/art-auction/src/app/api/stripe/webhook/route.ts`) at
  `market.arts-collective.com`. Every app shares the database, so a workshop
  bought on innergathering is confirmed by this route. Do not add a webhook
  endpoint per app; add a return hop instead.
- Two Stripe endpoint objects point at that URL: the platform endpoint
  (order events) and a `connect: true` endpoint (connected-account events such
  as `account.updated`). A plain endpoint never receives connected-account
  events; that is why onboarding did not stamp `stripe_onboarded_at` before
  2026-09-20. Each endpoint has its own signing secret, shown by Stripe only at
  creation. `parseWebhook` (`packages/payments/src/providers/stripe.ts:231`)
  tries `STRIPE_WEBHOOK_SECRET` then `STRIPE_CONNECT_WEBHOOK_SECRET`.
- `handleStripeWebhook` handles five event types:
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`
  (→ `confirmOrderPaid`), `checkout.session.expired`,
  `checkout.session.async_payment_failed` (→ cancel card-rail
  `pending_payment` orders only), `account.updated` with `payouts_enabled`
  (→ `markStripeAccountOnboarded`). It returns 2xx for ignored events.
- Return-visit reconciliation covers webhook latency: `syncStripeOrder` for
  orders, `refreshStripeAccountStatus` for onboarding. Every onboarding return
  page must call the latter: art-auction `/studio/payouts`, ifac `/hub`
  (`?payouts=done`), innergathering `/account` (`?payouts=done`).
- Dev forwarding with the Stripe CLI: forward to `127.0.0.1`, not
  `localhost` — the CLI resolves `localhost` to `::1` and the compose port
  mapping resets IPv6 connections ("connection reset by peer"). The CLI is at
  `~/bin/stripe` (not on PATH); `export STRIPE_API_KEY="$STRIPE_SECRET_KEY"`
  avoids the browser login. See `.env.example` near `STRIPE_WEBHOOK_SECRET`.

### Return URLs

`request.nextUrl.origin` reports the bind address (`0.0.0.0:<port>`) because
apps start with `-H 0.0.0.0`. Use
`apps/innergathering/src/lib/public-origin.ts` (`x-forwarded-host` → `host` →
`NEXT_PUBLIC_APP_URL`) for any URL handed to Stripe or another service.
art-auction builds URLs from `siteConfig.url` (`apps/art-auction/src/app/actions.ts:86`);
ifac and innergathering pass `process.env.NEXT_PUBLIC_APP_URL` to
`startPayoutsFor`. innergathering's public URL is `INNERGATHERING_URL`, which
is not the hyphenated app's `INNER_GATHERING_URL`.

### Storefront UI (2026-09-16/17)

- `ProductCard` / `ProductGrid` use `@elkdonis/commerce/commerce.css` (plain
  CSS, `--pc-*` variables on `.eac-commerce`), not Tailwind. Hosts importing it:
  art-auction, artdirect, amrit-canada, sunjay, ifac. `variant="wall"`
  (default, gallery hang) or `"tile"`. `srcset` over the `?w=` media convention
  (`THUMBNAIL_WIDTHS`, `packages/services/src/media-thumbnail.ts:19`); `src`
  fallback is the 512 render.
- Older components (`BuyNowButton`, `BidWidget`, checkout form) are Tailwind
  and render unstyled unless the host `@source`s `packages/commerce/src` and
  `packages/checkout/src` (art-auction `src/app/globals.css:18-19`).
- `attachPricing` (`packages/commerce/src/queries/index.ts:300`, private)
  hydrates the cheapest variant and open lot for a list in two queries. Used by
  `listArtworks`, `listStoreFrontArtworks`, `listPresentedArtworks`,
  `listStoreArtworks`; `listFeaturedArtworks` and `getStoreShowcaseForUser`
  go through `listArtworks`.
- `marketplaceLinks(baseUrl, { from, returnTo })` builds marketplace URLs
  (base = `NEXT_PUBLIC_ART_AUCTION_URL`). 2026-09-23 only ifac and
  `packages/blocks` call it; about a dozen other files concatenate
  `NEXT_PUBLIC_ART_AUCTION_URL` directly.
- art-auction `src/proxy.ts` + `src/config/network.ts` read `?from=<app>`,
  remember it in cookie `ea_market_from` for 6h, and resolve only registered
  app ids.
- Store on an org-site profile: flag `users.profile_sections.store` (105),
  read `getStoreShowcaseForUser`, render `StoreShowcase`. Org sites do not carry
  cart or checkout code.
- Studio: `/studio?store=<id>` (cookie `ea_studio_store`) is the seller
  console for any store on the person's roll; `/admin` is the operator.

### Verification scripts

- `packages/commerce/scripts/e2e-marketplace.ts` — 83 checks through the real
  server functions against the live database, self-cleaning (uses org `saw`).
  Run with the command in its header, which overrides `STRIPE_*` with dummies
  so no Stripe call is made. Also `probe-paid-workshop.mts`,
  `probe-settlement.mts`, `seed-listing.ts`, `seed-org-front.ts`.
- `packages/payments/scripts/probe-connect.mts` calls the real Stripe API and
  refuses anything but a test key (`:54`), so it cannot run on the live key.

## Rules and constraints

- Insert `owner_user_id` or `owner_org_id`, never `owner_kind`: it is a
  generated column and an explicit value errors.
- Use LEFT JOINs to `users`/`organizations` from `store` and to the maker
  from `artwork`: the owner is polymorphic and the maker nullable, and inner
  joins have hidden org stores and org-owned work three times.
- Resolve `/artists/[handle]` with `getStoreByHandle`: cards link by slug, and
  a uuid comparison on a slug raises a 500.
- Pass jsonb with `jsonb()` (`packages/commerce/src/server/map-order.ts:14`)
  or `db.json()`, never `${JSON.stringify(x)}::jsonb`: the driver encodes the
  string again and the column stores a JSON string.
- Never give an org a Stripe connected account or a payout destination: an
  org's share exists only as a `payout_ledger` row.
- Get the payee from `resolveSettlement`, not from app config or a store
  column: store `payout_email`/`commission_rate` are dead, and config emails
  sent practitioners' money to site inboxes before 097.
- Never filter `resolveOrgShare` by agreement `status = 'active'`: publishing a
  new version would silently zero the org's cut for every earlier acceptance.
- Never update or delete `payout_ledger` rows: reversals and releases are new
  rows; balances are derived.
- Let only a network admin release held funds: an org releasing its own hold
  defeats the hold.
- Grant workshop/event seats only through `confirmOrderPaid`: any RSVP write
  before payment hands out a paid place for free.
- Build success/cancel/return URLs with `publicOrigin()` or a configured
  public URL, never `request.nextUrl.origin`: it reports `0.0.0.0:<port>`.
- Do not register another Stripe webhook endpoint per app: one route serves
  the shared database; add a return hop (`/api/checkout/return`) instead.
- Keep both webhook secrets set: the Connect endpoint's secret is separate,
  and without it `account.updated` fails signature checks.
- Make every onboarding return page call `refreshStripeAccountStatus`, or the
  seller returns to a page that never stamps them onboarded.
- Do not run `probe-connect.mts` or create/delete test objects with the `.env`
  key: it is live. Probe write scope with deliberately invalid params instead
  (`400 parameter_missing` = permitted, `403 more_permissions_required` = denied).
- Run the e2e only with the dummy `STRIPE_*` overrides from its header: the
  containers carry live keys.

## Open items

- **unknown** — one `users` row has `stripe_account_id` set and no
  `stripe_onboarded_at`, with `payout_method = 'etransfer'`. It may be the
  test-mode account created from innergathering on 2026-09-17; a live key
  cannot read a test-mode account. Check in the Stripe dashboard before
  relying on it.
- **assumed** — the live restricted key has `connected_account_write` and
  `account_link_write`. Evidence: two accounts onboarded and were stamped on
  2026-09-20, after the switch to live keys on 2026-09-18, and the
  2026-09-19 finding was recorded as corrected on 2026-09-20. Not probed on
  2026-09-23.
- Confirm `ART_AUCTION_GALLERY_PAYOUT_EMAIL` (host account eTransfer address
  and settlement correspondence) with the collective.
- Processing fees on destination charges come out of the platform side;
  application fees make the collective a platform for tax/dispute purposes.
  Accounting decision, not an engineering one.
- `splitCommission` still returns `artistShareMinor` / `galleryShareMinor`.
- No `product` threads exist; collections/curator shares (roadmap step 7) not
  started.
- Service orders are not sold by a store; `commerce_order.store_id` stays
  nullable. hidden-enneagram still uses `createServiceOrder`.
- Pre-097 `workshop_join_requests` rows have no `order_id`.
- art-auction admin lists held funds but releases happen only on the
  arts-collective hub ledger.
- `marketplaceLinks` adoption: most apps still concatenate
  `NEXT_PUBLIC_ART_AUCTION_URL`.

### Changes since COMMERCE_HANDOVER (2026-09-05, last section 2026-09-08)

The handover predates live Stripe. Superseded since:
- Stripe "blocked on keys" / stub (§1, §11, §12): test keys 2026-09-16, live
  2026-09-18, platform account charges and payouts enabled.
- One webhook secret (§12): two endpoints, two secrets (2026-09-20).
- No public domain / `ART_AUCTION_URL` unset (§12 addendum): now
  `market.arts-collective.com`, variable set. Stripe env also reaches
  innergathering and ifac, not only art-auction.
- Workshops paid by eTransfer via `workshop_join_requests` (§10): the live
  path is innergathering's card rail, enrolment in `confirmOrderPaid`.
- Added: country-gated onboarding (`payout-rails.ts`, `startPayoutsFor`), card
  ceiling (2026-09-21), `ProductCard`/`commerce.css`/`attachPricing`/
  `marketplaceLinks` (2026-09-16), `ArtPieceComposer` in cms-ui and the
  artwork-not-a-thread decision (2026-09-17). e2e grew from 73 to 83 checks.

## Sources

Supersedes, for current state:
- `docs/archive/COMMERCE_HANDOVER_2026-09-05.md` (full history of 092–098,
  111, 112; read for rationale)
- `docs/archive/COMMERCE_KICKOFF_PROMPT.md`
- `docs/archive/MARKETPLACE_NAMING.md` (still the full vocabulary tables)
- Memory: `project_payments_stripe`, `stripe_connect_webhook`,
  `project_payee_and_agreements`, `project_marketplace_operations`,
  `project_marketplace_storefront`, `project_commerce_stores`,
  `project_paid_workshops_checkout`
