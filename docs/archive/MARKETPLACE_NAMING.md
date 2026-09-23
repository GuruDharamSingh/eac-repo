# Marketplace naming conventions

**Written 2026-09-08.** The words the marketplace uses, in the database, in
TypeScript, in URLs, and on screen — and the words it deliberately does not.
Read this before adding a table, a type, a route or a label to anything that
sells. The reference implementation is `apps/art-auction` on
`packages/commerce`; every other site is expected to borrow these names, not
invent parallel ones.

The three centralising sites divide the nouns:

| site | owns the noun | everything else is a window onto it |
|---|---|---|
| ArtDirect | **profile** (a person's identity) | an org site shows an `org_profile` of it |
| arts-collective | **hub** / **organisation** (membership, agreements, ledger) | |
| art-auction | **store** / **listing** / **order** (commerce) | an org site shows a `StoreShowcase` of it |

---

## 1. The people and the fronts

| word | means | table / type | not this |
|---|---|---|---|
| **person** / **user** | an account. Identity (name, photo, bio, slug) lives here and nowhere else (084). | `users` · `Profile` (services) | ~~artist_profiles~~ (closed down), ~~directory_profiles~~ |
| **organisation** / **org** | a group with members and a hub. Spelt *organisation* in prose, `org` in code. | `organizations` · `user_organizations` | ~~tenant~~, ~~gallery~~ |
| **profile** | the person, as shown. Network-wide on ArtDirect; per-org presentation in `org_profiles` (role title, photo override, publish flag). | `Profile` · `OrgProfile` | |
| **profile section** | an optional block a person switches on for their own page on a given site: `{ "store": true, "elkdonisFeed": true }`. Readers ignore unknown keys. | `users.profile_sections` (105) | |
| **store** | the commercial front a person or an org sells through. Commerce config only (currency, status, blurb, links) — identity is the owner's. One per owner per marketplace. | `store` · `Store` | ~~marketplace_artists~~ (renamed 094), ~~shop~~, ~~seller profile~~ |
| **front** | what a store *is* in the money model: a window, never a payee. Used in comments and docs; the table is still `store`. | | |
| **marketplace** | the org a store trades *in* — `store.org_id`. Art-auction's is `market`. Distinct from who owns the store. | `store.org_id` · `siteConfig.marketplaceOrgId` | |
| **owner** | who takes the store's revenue: a person (`owner_user_id`) **or** an org (`owner_org_id`), never both. `owner_kind` is generated. | `store.owner_*` · `StoreOwnerKind` | |
| **store member** / **the roll** | who may act for a store: `owner · manager · staff`. Deliberately not the org's membership. | `store_member` · `StoreMember`, `StoreMemberRole` | ~~team member~~ in code (the UI heading says "Team") |
| **actable store** | a store the signed-in person may act for — own, or on the roll. | `ActableStore` (`Store & { myRole }`) | |
| **handle** | what a store URL is addressed by: the owner's `slug`, falling back to an id. `/artists/[handle]`. | `getStoreByHandle` | |
| **present** / **presented** | a store showing a piece another store sells (112). The seller and payee do not change; the presenting front is the **window** a sale is logged through, and its owning org is the split **counterparty**. | `store_presentation` · `presentArtwork` · `Artwork.presentedByStoreId` | ~~consign~~, ~~feature~~, ~~curate~~ (reserved for collections) |
| **via** | the window the buyer came through: `?via=<storeId>` on a piece, `cart_line.via_store_id`, then `commerce_order_line.presented_store_id`. | | |

**Store status** (`store.status`): `pending · active · paused · rejected`.
A person's store *applies* and is *approved*; an org's store is *opened* by an
org owner and lands `active`.

---

## 2. The things for sale

| word | means | table / type | not this |
|---|---|---|---|
| **artwork** / **piece** | the thing sold: a painting, print, sculpture, photograph. "Artwork" in code and tables; "piece" in copy. | `artwork` · `Artwork` | ~~product~~ (see below), ~~item~~, ~~work~~ (only in headings: "Works (12)") |
| **listing** / **listed** | an artwork that is public and buyable: `status = 'available'`. "Publish" makes a listing; "Unlist" archives it. A verb-ish word, not a table. | `artwork.status` | ~~listing~~ as a table name |
| **variant** | the priced, countable unit of an artwork (price, currency, inventory, edition number). Every artwork has at least a `Default` variant; carts, orders and lots point at variants. | `artwork_variant` · `ArtworkVariant` | ~~SKU~~ (a column on it, not the noun) |
| **media** / **image** | an artwork's pictures, ordered; the first is the **primary image**. | `artwork_media` · `ArtworkMedia` | |
| **kind** | `original · limited_edition · open_edition`. | `artwork.kind` · `ArtworkKind` | ~~type~~ |
| **price on request** | a listed piece whose variant price is 0: shown, not buyable; the buyer messages the artist. | `price_minor = 0` | ~~POA~~, ~~enquire~~ in code |
| **maker** | who *made* the artwork — `artwork.artist_user_id`, nullable since 095 (org-owned merch has none). The maker is the **payee**. | `artist_user_id` (column) · "maker" (code, docs) | The column keeps its old name; new code says *maker*. |
| **seller** | who *sells* it — the store. `artwork.store_id`. | `store_id` | |
| **credit** | whose name appears on a card: the maker, else the selling store. | `artist_name` / `artist_slug` (query columns) | |
| **product** (thread kind) | a *purchasable thread* — service, workshop, event, product — sold by the no-cart "book now" rail. `product` is accepted by `PURCHASABLE_THREAD_KINDS` but nothing creates one yet. Artwork is **not** a thread. | `threads.kind` · `PurchasableThreadKind` | Do not call an artwork a product. |

**Artwork status**: `draft → available → reserved → sold`, plus `archived`
(unlisted). `reserved` is *held for an unpaid order*; it goes back to
`available` when that order is cancelled or expires.

---

## 3. Auctions

| word | means | table / type |
|---|---|---|
| **lot** | a timed sale of one variant. "Put up for auction" creates one; it is the only way to own the piece while open. | `auction_lot` · `AuctionLot` |
| **bid** | an offer on a lot. `winning · outbid · retracted`. | `bid` · `Bid` |
| **hammer** (price) | the winning bid; the winner's order is created at it. | `current_bid_minor` at settlement |
| **reserve** | the lowest hammer the seller will accept; below it the lot **passes**. | `reserve_minor` |
| **settle** (a lot) | close an ended lot: `sold` (winner's order created) or `passed`. Lazy, from any page that lists lots. | `settleExpiredLots` |
| **withdraw** | cancel a lot with no bids. | `cancelLot` → `cancelled` |

**Lot status**: `scheduled · live · sold · passed · cancelled` (`ended` exists
in the CHECK but nothing writes it). At most one *open* lot per variant
(migration 111).

---

## 4. Buying

| word | means | table / type |
|---|---|---|
| **cart** / **basket** | a buyer's pending selection. "Cart" in code and routes; "basket" is allowed in copy. Pinned to one store once it has a line. | `cart` · `Cart` |
| **line** | one variant × quantity, in a cart or an order. | `cart_line` · `commerce_order_line` · `CartLine`, `OrderLine` |
| **reservation** | the hold on a variant while an order is unpaid. | `reservation` |
| **order** | a purchase from **one store**: lines, buyer, totals, payment state. | `commerce_order` · `Order` |
| **order number** | the human reference: `ART-YYYYMMDD-NNNN`. Also the eTransfer reference. | `commerce_order.number` |
| **rail** | how the buyer pays: `etransfer` or `stripe` (`manual` = recorded by an admin). An unpaid order can switch rails. | `payment_method` · `OrderRail` |
| **customer** / **buyer** | who is buying. `customer_*` columns; "buyer" in copy. | `customer_id`, `customer_email` |
| **confirm** (payment) | mark an order paid: seller for eTransfer, webhook for card. | `confirmOrderPaid` |
| **fulfil** / **shipped** | the seller sent it. Spelt *fulfil* (`markOrderFulfilled`, status `fulfilled`). | |
| **cancel** / **expire** | release an unpaid order (by hand / by the payment window lapsing). | `cancelOrder`, `releaseExpiredOrders` |
| **refund** | reverse a paid order in full; the piece goes back on sale. | `refundOrder`, `refundStripeOrder` |

**Order status**: `draft · pending_payment (card, not paid) · awaiting_etransfer ·
payment_received · paid · fulfilled · completed · cancelled · refunded`.
"Unpaid" = the first three after `draft`.

---

## 5. Money

| word | means | where |
|---|---|---|
| **minor units** | every amount is an integer of cents: `*_minor`. Never floats, never major units in a table. | `amount_minor`, `price_minor`, … |
| **payee** | who is paid: **the maker**. Never a store, never an org's Stripe account. | `resolveSettlement` |
| **share** / **split** | how a line's total divides: `artist_share_minor` (the maker) and `gallery_share_minor` (the org). Old column names; code says *maker share* / *org share*. | `commerce_order_line` |
| **agreement** | the only thing that authorises an org's share: versioned terms a person accepted. No agreement, no cut. | `org_agreements`, `org_agreement_acceptances` |
| **earmark** | what an org's share is: a ledger balance inside the host account, never a transfer. | `payout_ledger` party `org` |
| **payout identity** | where a person's money goes: `payout_email` (eTransfer) and/or `stripe_account_id` + `stripe_onboarded_at`. On `users`, once, for every front. | `PayoutIdentity` |
| **ledger** | append-only record of what each party is owed: `accrual · release · payout · adjustment · refund`. Balance is summed, never stored. | `payout_ledger` |
| **held** / **hold reason** | an accrual not yet payable: `no_payout_account · below_threshold · org_unowned · dispute_window`. | `hold_reason` |
| **payout** (row) | a transfer that actually happened (`etransfer · stripe · manual`). | `payout` |
| **destination charge** | a Stripe charge routed straight to the maker's connected account, with the org's cut kept as the application fee. | `@elkdonis/checkout/stripe` |
| **host account** / **platform** | the collective's own Stripe/eTransfer account. Party kind `platform`. | `HOST_PAYOUT_EMAIL` |

---

## 6. Routes and screens (art-auction)

| route | what it is | naming note |
|---|---|---|
| `/artworks`, `/artworks/[id]` | browse; a piece | id, not slug — slugs are per-org and pieces are cross-org |
| `/artists`, `/artists/[handle]` | stores. The segment is `artists` for readers; the object behind it is a **store** (an org's store lives here too). | `handle` = owner slug or id |
| `/lots`, `/lots/[id]` | auctions | |
| `/cart` → `/checkout` → `/orders/[id]` | buy. The order page is *the* pay-for-this surface (cart orders, auction wins, rail switches). | |
| `/studio` | the seller's console, for whichever **actable store** is selected (`?store=`) | "Studio", not "dashboard" / "seller portal" |
| `/studio/apply` | "Sell": apply for own store, open an org store | |
| `/admin` | the marketplace operator | |
| `/account` | the buyer | |

Screen labels: **Store** (your pieces) · **Sales** (orders through your store)
· **Auctions** · **Payouts** (person) / **Money** (org) · **Team** (the roll) ·
**Messages** · **Across the network** (ArtDirect, hub, agreements).

---

## 7. Package and function names

| package / path | holds |
|---|---|
| `@elkdonis/commerce/types` | every domain type above |
| `@elkdonis/commerce/queries` | reads: `listArtworks`, `getStoreByHandle`, `listStoresForUser`, `listOrdersForStore`, `getStoreShowcaseForUser`, … |
| `@elkdonis/commerce/server` | writes: `applyForStore`/`openOrgStore`, `createArtwork`/`publishArtwork`, `createOrderFromCart`/`confirmOrderPaid`/`cancelOrder`/`refundOrder`, `createLot`/`settleExpiredLots`, ledger |
| `@elkdonis/commerce/components` | portable UI: `ArtworkCard`, `ArtworkGrid`, `PriceBlock`, `BidWidget`, `BuyNowButton`, `StoreShowcase` |
| `@elkdonis/payments` | rails: `createEtransferProvider`, `getStripeProvider` |
| `@elkdonis/checkout/server` | cart cookie; `@elkdonis/checkout/stripe` — session, webhook, onboarding, refund glue |
| `packages/commerce/scripts/` | `e2e-marketplace.ts` (verification), `seed-listing.ts` (a person's store + a piece, or their whole portfolio), `seed-org-front.ts` (an org's front presenting members' work) |

Verb conventions: **apply / approve / reject / pause** (stores) · **create /
publish / archive** (artwork) · **add to cart / remove** · **place** (an
order, a bid) · **confirm / cancel / fulfil / refund** (orders) · **put up /
withdraw / settle** (lots) · **accrue / hold / release / pay out** (ledger).
Prefixes: `list*` returns arrays, `get*` one-or-null, `can*` booleans,
`require*` throws or redirects, `*Action` is a Next server action.

---

## 8. Deprecated names still in the code

Kept so old callers compile; do not use in new code.

| old | use instead |
|---|---|
| `MarketplaceArtist`, `getMarketplaceArtist`, `listMarketplaceArtists`, `applyAsArtist`, `listPendingArtistApplications` | `Store`, `getStoreForUser`, `listStores`, `applyForStore`, `listPendingStoreApplications` |
| `getCurrentArtist`, `requireApprovedArtist` (art-auction) | `getCurrentStore`, `requireStudioStore` |
| `createEtransferOrder`, `confirmEtransferReceived` | `createOrderFromCart({ paymentMethod })`, `confirmOrderPaid` |
| `createServiceOrder` | `createThreadOrder` |
| `store.display_name / headline / city / photo_url / payout_email / commission_rate` | the owner's `users` row; agreements |
| `splitCommission → { artistShareMinor, galleryShareMinor }` | read as maker / org share |
